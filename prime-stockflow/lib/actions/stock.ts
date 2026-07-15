"use server";

import { withAuth, ok, fail } from "@/lib/actions/result";
import { getSupabase } from "@/lib/supabase/server";
import { stockSearchSchema } from "@/lib/validation/schemas";
import { availableStock } from "@/lib/domain/stock";

export interface StockListItem {
  sku_code: string;
  item_name: string;
  qty: number;
  reserved: number;
  available: number;
  bin_location: string;
}

export async function searchStockAction(input: {
  query?: string;
  page?: number;
  pageSize?: number;
}) {
  return withAuth(async () => {
    const parsed = stockSearchSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid input", "VALIDATION");
    }

    const { query, page, pageSize } = parsed.data;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const supabase = getSupabase();

    let skuQuery = supabase
      .from("skus")
      .select("sku_code, item_name", { count: "exact" })
      .order("sku_code")
      .range(from, to);

    if (query) {
      skuQuery = skuQuery.or(
        `sku_code.ilike.%${query}%,item_name.ilike.%${query}%`
      );
    }

    const { data: skus, error, count } = await skuQuery;
    if (error) return fail(error.message, "SERVER");

    const codes = (skus ?? []).map((s) => s.sku_code);
    const { data: stockRows } = await supabase
      .from("stock")
      .select("*")
      .in("sku_code", codes.length ? codes : ["__none__"]);

    const stockMap = new Map((stockRows ?? []).map((s) => [s.sku_code, s]));

    const items: StockListItem[] = (skus ?? []).map((sku) => {
      const stock = stockMap.get(sku.sku_code);
      const qty = stock?.qty ?? 0;
      const reserved = stock?.reserved ?? 0;
      return {
        sku_code: sku.sku_code,
        item_name: sku.item_name,
        qty,
        reserved,
        available: availableStock(qty, reserved),
        bin_location: stock?.bin_location ?? "",
      };
    });

    return ok({
      items,
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    });
  });
}
