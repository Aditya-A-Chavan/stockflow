"use server";

import { withAuth, ok, fail } from "@/lib/actions/result";
import { getSupabase } from "@/lib/supabase/server";
import { dispatchSchema } from "@/lib/validation/schemas";

export async function dispatchOrderAction(input: { orderNo: string }) {
  return withAuth(async (username) => {
    const parsed = dispatchSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid input", "VALIDATION");
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("dispatch_order", {
      p_order_no: parsed.data.orderNo,
      p_username: username,
    });

    if (error) {
      return fail(error.message, "SERVER");
    }

    return ok(data as { success: boolean });
  });
}
