"use server";

import { withAuth, ok, fail } from "@/lib/actions/result";
import { getSupabase } from "@/lib/supabase/server";
import { reserveSchema } from "@/lib/validation/schemas";

export async function reserveStockAction(input: {
  orderNo: string;
  skuCode: string;
  qty: number;
}) {
  return withAuth(async (username) => {
    const parsed = reserveSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid input", "VALIDATION");
    }

    const { orderNo, skuCode, qty } = parsed.data;
    const supabase = getSupabase();

    const { data, error } = await supabase.rpc("reserve_stock", {
      p_order_no: orderNo,
      p_sku_code: skuCode,
      p_qty: qty,
      p_username: username,
    });

    if (error) {
      return fail(error.message, "SERVER");
    }

    return ok(data as { success: boolean; status: string });
  });
}
