"use server";

import { withAuth, ok, fail } from "@/lib/actions/result";
import { getSupabase } from "@/lib/supabase/server";
import { lookupSchema } from "@/lib/validation/schemas";
import { availableStock } from "@/lib/domain/stock";

export interface LookupResult {
  found: boolean;
  code: string;
  sku?: {
    sku_code: string;
    item_name: string;
    hsn: string;
    uom: string;
    ean: string | null;
  };
  stock?: {
    qty: number;
    reserved: number;
    available: number;
    bin_location: string;
  };
  pendingOrders?: Array<{
    order_no: string;
    party_name: string;
    status: string;
    due_date: string | null;
    qty_ordered: number;
    qty_reserved: number;
    still_needed: number;
  }>;
}

type OrderJoin = {
  order_no: string;
  party_name: string;
  status: string;
  due_date: string | null;
};

function unwrapOrder(orders: OrderJoin | OrderJoin[] | null): OrderJoin | null {
  if (!orders) return null;
  return Array.isArray(orders) ? (orders[0] ?? null) : orders;
}

export async function lookupBarcodeAction(input: { code: string }) {
  return withAuth(async () => {
    const parsed = lookupSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid input", "VALIDATION");
    }

    const code = parsed.data.code;
    const supabase = getSupabase();

    let skuCode = code;

    const { data: skuByCode } = await supabase
      .from("skus")
      .select("*")
      .eq("sku_code", code)
      .maybeSingle();

    let sku = skuByCode;

    if (!sku) {
      const { data: skuByEan } = await supabase
        .from("skus")
        .select("*")
        .eq("ean", code)
        .maybeSingle();

      if (skuByEan) {
        sku = skuByEan;
        skuCode = skuByEan.sku_code;
      }
    }

    if (!sku) {
      return ok<LookupResult>({ found: false, code });
    }

    const { data: stockRow } = await supabase
      .from("stock")
      .select("*")
      .eq("sku_code", skuCode)
      .maybeSingle();

    const qty = stockRow?.qty ?? 0;
    const reserved = stockRow?.reserved ?? 0;
    const available = availableStock(qty, reserved);

    const { data: orderItems } = await supabase
      .from("order_items")
      .select(
        `
        qty_ordered,
        qty_reserved,
        orders!inner (
          order_no,
          party_name,
          status,
          due_date
        )
      `
      )
      .eq("sku_code", skuCode);

    const pendingOrders =
      orderItems
        ?.map((item) => {
          const order = unwrapOrder(
            item.orders as OrderJoin | OrderJoin[] | null
          );
          if (!order) return null;
          if (
            order.status === "dispatched" ||
            item.qty_reserved >= item.qty_ordered
          ) {
            return null;
          }
          return {
            order_no: order.order_no,
            party_name: order.party_name,
            status: order.status,
            due_date: order.due_date,
            qty_ordered: item.qty_ordered,
            qty_reserved: item.qty_reserved,
            still_needed: item.qty_ordered - item.qty_reserved,
          };
        })
        .filter((o): o is NonNullable<typeof o> => o !== null) ?? [];

    return ok<LookupResult>({
      found: true,
      code: skuCode,
      sku: {
        sku_code: sku.sku_code,
        item_name: sku.item_name,
        hsn: sku.hsn,
        uom: sku.uom,
        ean: sku.ean,
      },
      stock: {
        qty,
        reserved,
        available,
        bin_location: stockRow?.bin_location ?? "",
      },
      pendingOrders,
    });
  });
}
