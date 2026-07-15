"use server";

import { withAuth, ok, fail } from "@/lib/actions/result";
import { getSupabase } from "@/lib/supabase/server";
import { computeOrderStatus } from "@/lib/domain/stock";
import { createOrderSchema, ordersFilterSchema } from "@/lib/validation/schemas";
import { parseDueDateInput } from "@/lib/dates";

export interface OrderListItem {
  order_no: string;
  party_name: string;
  due_date: string | null;
  status: string;
  created_at: string;
  dispatched_at: string | null;
  total_ordered: number;
  total_reserved: number;
}

export async function getOrdersAction(input: {
  page?: number;
  pageSize?: number;
  filter?: "all" | "open" | "ready" | "done";
}) {
  return withAuth(async () => {
    const parsed = ordersFilterSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid input", "VALIDATION");
    }

    const { page, pageSize, filter } = parsed.data;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const supabase = getSupabase();
    let query = supabase
      .from("orders")
      .select(
        `
        order_no,
        party_name,
        due_date,
        status,
        created_at,
        dispatched_at,
        order_items (qty_ordered, qty_reserved)
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filter === "open") {
      query = query.in("status", ["open", "partial"]);
    } else if (filter === "ready") {
      query = query.eq("status", "ready");
    } else if (filter === "done") {
      query = query.eq("status", "dispatched");
    }

    const { data, error, count } = await query;

    if (error) return fail(error.message, "SERVER");

    const orders: OrderListItem[] = (data ?? []).map((o) => {
      const items = (o.order_items ?? []) as Array<{
        qty_ordered: number;
        qty_reserved: number;
      }>;
      return {
        order_no: o.order_no,
        party_name: o.party_name,
        due_date: o.due_date,
        status: o.status,
        created_at: o.created_at,
        dispatched_at: o.dispatched_at,
        total_ordered: items.reduce((s, i) => s + i.qty_ordered, 0),
        total_reserved: items.reduce((s, i) => s + i.qty_reserved, 0),
      };
    });

    return ok({
      orders,
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    });
  });
}

export interface OrderDetailItem {
  id: number;
  sku_code: string;
  item_name: string | null;
  qty_ordered: number;
  qty_reserved: number;
  unknown_sku: boolean;
  available: number;
}

export async function getOrderDetailAction(orderNo: string) {
  return withAuth(async () => {
    const supabase = getSupabase();

    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("order_no", orderNo)
      .maybeSingle();

    if (error) return fail(error.message, "SERVER");
    if (!order) return fail("Order not found", "SERVER");

    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_no", orderNo);

    if (itemsError) return fail(itemsError.message, "SERVER");

    const skuCodes = (items ?? []).map((i) => i.sku_code);
    const { data: skus } = await supabase
      .from("skus")
      .select("sku_code, item_name")
      .in("sku_code", skuCodes.length ? skuCodes : ["__none__"]);

    const { data: stockRows } = await supabase
      .from("stock")
      .select("sku_code, qty, reserved")
      .in("sku_code", skuCodes.length ? skuCodes : ["__none__"]);

    const skuMap = new Map((skus ?? []).map((s) => [s.sku_code, s.item_name]));
    const stockMap = new Map(
      (stockRows ?? []).map((s) => [s.sku_code, s])
    );

    const detailItems: OrderDetailItem[] = (items ?? []).map((item) => {
      const stock = stockMap.get(item.sku_code);
      const available = stock
        ? Math.max(0, stock.qty - stock.reserved)
        : 0;
      return {
        id: item.id,
        sku_code: item.sku_code,
        item_name: skuMap.get(item.sku_code) ?? null,
        qty_ordered: item.qty_ordered,
        qty_reserved: item.qty_reserved,
        unknown_sku: item.unknown_sku,
        available,
      };
    });

    return ok({
      order,
      items: detailItems,
    });
  });
}

export async function createOrderAction(input: {
  orderNo: string;
  partyName: string;
  dueDate?: string;
  items: Array<{ skuCode: string; qtyOrdered: number }>;
}) {
  return withAuth(async (username) => {
    const parsed = createOrderSchema.safeParse({
      orderNo: input.orderNo,
      partyName: input.partyName,
      dueDate: input.dueDate ?? "",
      items: input.items,
    });

    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid input", "VALIDATION");
    }

    const { orderNo, partyName, dueDate, items } = parsed.data;
    const supabase = getSupabase();

    const { data: existing } = await supabase
      .from("orders")
      .select("order_no")
      .eq("order_no", orderNo)
      .maybeSingle();

    if (existing) {
      return fail("Order number already exists", "VALIDATION");
    }

    const merged = new Map<string, number>();
    for (const item of items) {
      merged.set(item.skuCode, (merged.get(item.skuCode) ?? 0) + item.qtyOrdered);
    }

    const skuCodes = Array.from(merged.keys());
    const { data: knownSkus } = await supabase
      .from("skus")
      .select("sku_code")
      .in("sku_code", skuCodes);

    const knownSet = new Set((knownSkus ?? []).map((s) => s.sku_code));

    const orderItems = Array.from(merged.entries()).map(([skuCode, qtyOrdered]) => ({
      order_no: orderNo,
      sku_code: skuCode,
      qty_ordered: qtyOrdered,
      qty_reserved: 0,
      unknown_sku: !knownSet.has(skuCode),
    }));

    const { error: orderError } = await supabase.from("orders").insert({
      order_no: orderNo,
      party_name: partyName,
      due_date: parseDueDateInput(dueDate),
      status: computeOrderStatus(orderItems.map((i) => ({ qty_ordered: i.qty_ordered, qty_reserved: 0 }))),
    });

    if (orderError) return fail(orderError.message, "SERVER");

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      await supabase.from("orders").delete().eq("order_no", orderNo);
      return fail(itemsError.message, "SERVER");
    }

    await supabase.from("activity_log").insert({
      message: `New order ${orderNo} (${partyName}) added`,
      username,
    });

    return ok({ orderNo });
  });
}
