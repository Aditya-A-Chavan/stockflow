"use server";

import { withAuth, ok, fail } from "@/lib/actions/result";
import { getSupabase } from "@/lib/supabase/server";
import { paginationSchema } from "@/lib/validation/schemas";

export async function getDashboardStatsAction() {
  return withAuth(async () => {
    const supabase = getSupabase();

    const [skuCount, openOrders, reservedSum, readyCount] = await Promise.all([
      supabase.from("skus").select("*", { count: "exact", head: true }),
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .neq("status", "dispatched"),
      supabase.from("stock").select("reserved"),
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "ready"),
    ]);

    const totalReserved = (reservedSum.data ?? []).reduce(
      (sum, row) => sum + (row.reserved ?? 0),
      0
    );

    return ok({
      totalSkus: skuCount.count ?? 0,
      openOrders: openOrders.count ?? 0,
      totalReserved,
      readyOrders: readyCount.count ?? 0,
    });
  });
}

export async function getActivityAction(input?: { page?: number; pageSize?: number; limit?: number }) {
  return withAuth(async () => {
    const parsed = paginationSchema.safeParse({
      page: input?.page ?? 1,
      pageSize: input?.limit ?? input?.pageSize ?? 20,
    });

    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid input", "VALIDATION");
    }

    const { page, pageSize } = parsed.data;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const supabase = getSupabase();
    const { data, error, count } = await supabase
      .from("activity_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) return fail(error.message, "SERVER");

    return ok({
      items: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    });
  });
}
