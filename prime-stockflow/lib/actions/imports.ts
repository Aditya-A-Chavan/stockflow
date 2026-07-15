"use server";

import { withAuth, ok, fail } from "@/lib/actions/result";
import { getSupabase } from "@/lib/supabase/server";
import { addSkuSchema } from "@/lib/validation/schemas";
import {
  getCell,
  lastRowWins,
  parseCsvText,
  requireColumns,
  type CsvRow,
} from "@/lib/csv/parsers";

export interface ImportResult {
  imported: number;
  skipped?: number;
  warnings?: string[];
}

export async function importSkusFromCsvAction(csvText: string) {
  return withAuth(async (username) => {
    let rows: CsvRow[];
    try {
      rows = parseCsvText(csvText);
      requireColumns(rows, ["sku_code"], { sku_code: ["sku"] });
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Invalid CSV", "VALIDATION");
    }

    const parsed = lastRowWins(
      rows
        .map((r) => ({
          sku_code: getCell(r, "sku_code", "sku"),
          item_name: getCell(r, "item_name", "name") || getCell(r, "sku_code", "sku"),
          hsn: getCell(r, "hsn"),
          uom: getCell(r, "uom") || "PCS",
          ean: getCell(r, "ean") || null,
        }))
        .filter((r) => r.sku_code),
      (r) => r.sku_code
    );

    if (parsed.length === 0) {
      return fail("No valid SKU rows found", "VALIDATION");
    }

    const supabase = getSupabase();
    const { error } = await supabase.from("skus").upsert(
      parsed.map((r) => ({
        sku_code: r.sku_code,
        item_name: r.item_name,
        hsn: r.hsn,
        uom: r.uom,
        ean: r.ean || null,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "sku_code" }
    );

    if (error) return fail(error.message, "SERVER");

    await supabase.from("activity_log").insert({
      message: `Imported ${parsed.length} SKUs from CSV`,
      username,
    });

    return ok<ImportResult>({ imported: parsed.length });
  });
}

export async function importStockFromCsvAction(csvText: string) {
  return withAuth(async (username) => {
    let rows: CsvRow[];
    try {
      rows = parseCsvText(csvText);
      requireColumns(rows, ["sku_code"], {
        sku_code: ["sku"],
      });
      requireColumns(rows, ["qty_on_hand"], { qty_on_hand: ["qty"] });
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Invalid CSV", "VALIDATION");
    }

    const parsed = lastRowWins(
      rows
        .map((r) => ({
          sku_code: getCell(r, "sku_code", "sku"),
          qty: parseInt(getCell(r, "qty_on_hand", "qty"), 10) || 0,
          bin_location: getCell(r, "bin_location", "bin"),
        }))
        .filter((r) => r.sku_code),
      (r) => r.sku_code
    );

    const supabase = getSupabase();
    const codes = parsed.map((r) => r.sku_code);
    const { data: existingSkus } = await supabase
      .from("skus")
      .select("sku_code")
      .in("sku_code", codes);

    const knownSet = new Set((existingSkus ?? []).map((s) => s.sku_code));
    const warnings: string[] = [];
    const toImport = parsed.filter((r) => {
      if (!knownSet.has(r.sku_code)) {
        warnings.push(`Skipped stock for unknown SKU: ${r.sku_code}`);
        return false;
      }
      return true;
    });

    if (toImport.length === 0) {
      return fail(
        warnings.length
          ? warnings.join("; ")
          : "No valid stock rows to import",
        "VALIDATION"
      );
    }

    const { data: existingStock } = await supabase
      .from("stock")
      .select("sku_code, reserved, bin_location")
      .in(
        "sku_code",
        toImport.map((r) => r.sku_code)
      );

    const stockMap = new Map(
      (existingStock ?? []).map((s) => [s.sku_code, s])
    );

    let imported = 0;

    for (const row of toImport) {
      const existing = stockMap.get(row.sku_code);
      const reserved = existing?.reserved ?? 0;
      const qty = row.qty;

      if (qty < reserved) {
        warnings.push(
          `SKU ${row.sku_code}: qty_on_hand (${qty}) is below reserved (${reserved}); import rejected for this row`
        );
        continue;
      }

      const { error } = await supabase.from("stock").upsert(
        {
          sku_code: row.sku_code,
          qty,
          reserved,
          bin_location: row.bin_location || existing?.bin_location || "",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "sku_code" }
      );

      if (error) {
        warnings.push(`SKU ${row.sku_code}: ${error.message}`);
      } else {
        imported++;
      }
    }

    await supabase.from("activity_log").insert({
      message: `Updated stock for ${imported} SKUs from CSV`,
      username,
    });

    return ok<ImportResult>({
      imported,
      warnings: warnings.length ? warnings : undefined,
    });
  });
}

export async function importOrdersFromCsvAction(csvText: string) {
  return withAuth(async (username) => {
    let rows: CsvRow[];
    try {
      rows = parseCsvText(csvText);
      requireColumns(rows, ["order_no"], { order_no: ["vno"] });
      requireColumns(rows, ["sku_code"], { sku_code: ["sku"] });
      requireColumns(rows, ["qty_ordered"], { qty_ordered: ["qty"] });
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Invalid CSV", "VALIDATION");
    }

    type GroupedOrder = {
      order_no: string;
      party_name: string;
      due_date: string | null;
      items: Map<string, number>;
    };

    const grouped = new Map<string, GroupedOrder>();

    for (const r of rows) {
      const orderNo = getCell(r, "order_no", "vno");
      if (!orderNo) continue;

      if (!grouped.has(orderNo)) {
        grouped.set(orderNo, {
          order_no: orderNo,
          party_name: getCell(r, "party_name", "party"),
          due_date: getCell(r, "due_date") || null,
          items: new Map(),
        });
      }

      const sku = getCell(r, "sku_code", "sku");
      const qty = parseInt(getCell(r, "qty_ordered", "qty"), 10) || 0;
      if (!sku || qty <= 0) continue;

      const order = grouped.get(orderNo)!;
      order.items.set(sku, (order.items.get(sku) ?? 0) + qty);
    }

    const supabase = getSupabase();
    const orderNos = Array.from(grouped.keys());

    const { data: existingOrders } = await supabase
      .from("orders")
      .select("order_no")
      .in("order_no", orderNos.length ? orderNos : ["__none__"]);

    const existingSet = new Set((existingOrders ?? []).map((o) => o.order_no));
    const skipped: string[] = [];
    let added = 0;
    const warnings: string[] = [];

    for (const order of grouped.values()) {
      if (existingSet.has(order.order_no)) {
        skipped.push(order.order_no);
        continue;
      }

      const skuCodes = Array.from(order.items.keys());
      const { data: knownSkus } = await supabase
        .from("skus")
        .select("sku_code")
        .in("sku_code", skuCodes);

      const knownSet = new Set((knownSkus ?? []).map((s) => s.sku_code));

      const orderItems = skuCodes.map((skuCode) => {
        const unknown = !knownSet.has(skuCode);
        if (unknown) {
          warnings.push(`Order ${order.order_no}: unknown SKU ${skuCode}`);
        }
        return {
          order_no: order.order_no,
          sku_code: skuCode,
          qty_ordered: order.items.get(skuCode)!,
          qty_reserved: 0,
          unknown_sku: unknown,
        };
      });

      const { error: orderError } = await supabase.from("orders").insert({
        order_no: order.order_no,
        party_name: order.party_name || "Unknown",
        due_date: order.due_date,
        status: "open",
      });

      if (orderError) {
        warnings.push(`Order ${order.order_no}: ${orderError.message}`);
        continue;
      }

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) {
        await supabase.from("orders").delete().eq("order_no", order.order_no);
        warnings.push(`Order ${order.order_no}: ${itemsError.message}`);
        continue;
      }

      added++;
    }

    if (added > 0) {
      await supabase.from("activity_log").insert({
        message: `Imported ${added} orders from CSV`,
        username,
      });
    }

    return ok<ImportResult>({
      imported: added,
      skipped: skipped.length,
      warnings: [
        ...(skipped.length
          ? [`Skipped existing orders: ${skipped.join(", ")}`]
          : []),
        ...warnings,
      ].filter(Boolean),
    });
  });
}

export async function addSkuManualAction(input: {
  skuCode: string;
  itemName: string;
  qty: number;
  binLocation?: string;
  ean?: string;
}) {
  return withAuth(async (username) => {
    const parsed = addSkuSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid input", "VALIDATION");
    }

    const { skuCode, itemName, qty, binLocation, ean } = parsed.data;
    const supabase = getSupabase();

    const { data: existingStock } = await supabase
      .from("stock")
      .select("reserved")
      .eq("sku_code", skuCode)
      .maybeSingle();

    const reserved = existingStock?.reserved ?? 0;
    if (qty < reserved) {
      return fail(
        `Quantity (${qty}) cannot be less than currently reserved (${reserved})`,
        "VALIDATION"
      );
    }

    const { error: skuError } = await supabase.from("skus").upsert(
      {
        sku_code: skuCode,
        item_name: itemName,
        hsn: "",
        uom: "PCS",
        ean: ean || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "sku_code" }
    );

    if (skuError) return fail(skuError.message, "SERVER");

    const { error: stockError } = await supabase.from("stock").upsert(
      {
        sku_code: skuCode,
        qty,
        reserved,
        bin_location: binLocation ?? "",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "sku_code" }
    );

    if (stockError) return fail(stockError.message, "SERVER");

    await supabase.from("activity_log").insert({
      message: `Added SKU ${skuCode} — ${itemName} (qty: ${qty})`,
      username,
    });

    return ok({ skuCode });
  });
}
