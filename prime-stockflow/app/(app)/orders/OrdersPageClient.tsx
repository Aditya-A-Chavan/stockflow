"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge, statusBadgeVariant } from "@/components/ui/Badge";
import { Card, CardHeader, EmptyState, DataRow } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Input, ProgressBar, Tabs } from "@/components/ui/Input";
import { toast } from "@/components/ui/ToastProvider";
import {
  createOrderAction,
  getOrderDetailAction,
  getOrdersAction,
  type OrderDetailItem,
  type OrderListItem,
} from "@/lib/actions/orders";
import { dispatchOrderAction } from "@/lib/actions/dispatch";
import { formatDueDate } from "@/lib/dates";

type Filter = "all" | "open" | "ready" | "done";

export default function OrdersPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFilter = (searchParams.get("filter") as Filter) || "all";

  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<{
    order_no: string;
    party_name: string;
    status: string;
    due_date: string | null;
  } | null>(null);
  const [detailItems, setDetailItems] = useState<OrderDetailItem[]>([]);

  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchOrderNo, setDispatchOrderNo] = useState("");
  const [dispatching, setDispatching] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [newOrderNo, setNewOrderNo] = useState("");
  const [newParty, setNewParty] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newItems, setNewItems] = useState<
    Array<{ sku: string; qty_ordered: number }>
  >([]);
  const [newItemSku, setNewItemSku] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [saving, setSaving] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await getOrdersAction({ filter, page, pageSize: 20 });
    setLoading(false);

    if (!res.success) {
      if (res.code === "UNAUTHORIZED") {
        router.push("/login?expired=1");
        return;
      }
      setError(res.error);
      return;
    }

    setOrders(res.data.orders);
    setTotalPages(res.data.totalPages);
  }, [filter, page, router]);

  useEffect(() => {
    startTransition(() => void loadOrders());
  }, [loadOrders]);

  async function openDetail(orderNo: string) {
    const res = await getOrderDetailAction(orderNo);
    if (!res.success) {
      if (res.code === "UNAUTHORIZED") router.push("/login?expired=1");
      else toast.error(res.error);
      return;
    }
    setDetailOrder(res.data.order);
    setDetailItems(res.data.items);
    setDetailOpen(true);
  }

  function openDispatch(orderNo: string) {
    setDispatchOrderNo(orderNo);
    setDispatchOpen(true);
  }

  async function confirmDispatch() {
    if (dispatching) return;
    setDispatching(true);
    const res = await dispatchOrderAction({ orderNo: dispatchOrderNo });
    setDispatching(false);

    if (!res.success) {
      if (res.code === "UNAUTHORIZED") router.push("/login?expired=1");
      else toast.error(res.error);
      return;
    }

    toast.success("Order dispatched!");
    setDispatchOpen(false);
    setDetailOpen(false);
    void loadOrders();
  }

  function addNewItem() {
    const sku = newItemSku.trim();
    const qty = parseInt(newItemQty, 10) || 0;
    if (!sku || qty <= 0) {
      toast.error("Enter SKU and qty");
      return;
    }
    setNewItems((prev) => {
      const existing = prev.find((i) => i.sku === sku);
      if (existing) {
        return prev.map((i) =>
          i.sku === sku ? { ...i, qty_ordered: i.qty_ordered + qty } : i
        );
      }
      return [...prev, { sku, qty_ordered: qty }];
    });
    setNewItemSku("");
    setNewItemQty("");
  }

  async function saveNewOrder() {
    if (saving) return;
    setSaving(true);
    const res = await createOrderAction({
      orderNo: newOrderNo.trim(),
      partyName: newParty.trim(),
      dueDate: newDue,
      items: newItems.map((i) => ({
        skuCode: i.sku,
        qtyOrdered: i.qty_ordered,
      })),
    });
    setSaving(false);

    if (!res.success) {
      if (res.code === "UNAUTHORIZED") router.push("/login?expired=1");
      else toast.error(res.error);
      return;
    }

    toast.success("Order added");
    setNewOpen(false);
    setNewOrderNo("");
    setNewParty("");
    setNewDue("");
    setNewItems([]);
    void loadOrders();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Sales orders</h1>
        <Button sm variant="primary" onClick={() => setNewOpen(true)}>
          + New
        </Button>
      </div>

      <Tabs
        tabs={[
          { id: "all", label: "All" },
          { id: "open", label: "Open" },
          { id: "ready", label: "Ready" },
          { id: "done", label: "Dispatched" },
        ]}
        active={filter}
        onChange={(id) => {
          setFilter(id as Filter);
          setPage(1);
        }}
      />

      {loading && <p className="text-sm text-text2">Loading orders…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && !error && orders.length === 0 && (
        <EmptyState message="No orders here" />
      )}

      {orders.map((o) => {
        const pct =
          o.total_ordered > 0
            ? Math.round((o.total_reserved / o.total_ordered) * 100)
            : 0;
        return (
          <Card key={o.order_no}>
            <CardHeader>
              <div>
                <div className="font-semibold text-base">{o.order_no}</div>
                <div className="text-[13px] text-text2 mt-0.5">
                  {o.party_name}
                  {o.due_date ? ` · Due: ${formatDueDate(o.due_date)}` : ""}
                </div>
              </div>
              <Badge variant={statusBadgeVariant(o.status)}>{o.status}</Badge>
            </CardHeader>
            <div className="text-[13px] text-text2 mb-1.5">
              {o.total_reserved}/{o.total_ordered} units reserved
            </div>
            <ProgressBar pct={pct} />
            <div className="mt-3 flex gap-2 flex-wrap">
              <Button sm onClick={() => void openDetail(o.order_no)}>
                View items
              </Button>
              {o.status === "ready" && (
                <Button
                  sm
                  variant="success"
                  onClick={() => openDispatch(o.order_no)}
                >
                  Dispatch
                </Button>
              )}
            </div>
          </Card>
        );
      })}

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <Button sm disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-text2">
            Page {page} of {totalPages}
          </span>
          <Button
            sm
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={
          detailOrder
            ? `${detailOrder.order_no} — ${detailOrder.party_name}`
            : "Order detail"
        }
        actions={
          <>
            {detailOrder?.status === "ready" && (
              <Button
                full
                variant="success"
                onClick={() => {
                  setDetailOpen(false);
                  openDispatch(detailOrder.order_no);
                }}
              >
                Dispatch this order
              </Button>
            )}
            <Button full onClick={() => setDetailOpen(false)}>
              Close
            </Button>
          </>
        }
      >
        {detailItems.map((item) => {
          const pct = Math.round((item.qty_reserved / item.qty_ordered) * 100);
          return (
            <div
              key={item.id}
              className="flex items-center gap-2.5 py-2.5 border-b border-border last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {item.item_name ?? item.sku_code}
                  {item.unknown_sku && (
                    <Badge variant="warn" className="ml-2">
                      Unknown SKU
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-text2 mt-0.5">
                  SKU: {item.sku_code} · Avail: {item.available}
                </div>
                <ProgressBar pct={pct} />
              </div>
              <div className="text-right shrink-0">
                <div
                  className={`text-base font-semibold ${pct >= 100 ? "text-success" : "text-warn"}`}
                >
                  {item.qty_reserved}
                </div>
                <div className="text-[11px] text-text2">
                  of {item.qty_ordered}
                </div>
              </div>
            </div>
          );
        })}
      </Modal>

      <Modal
        open={dispatchOpen}
        onClose={() => !dispatching && setDispatchOpen(false)}
        title={`Dispatch — ${dispatchOrderNo}`}
        actions={
          <>
            <Button
              full
              disabled={dispatching}
              onClick={() => setDispatchOpen(false)}
            >
              Cancel
            </Button>
            <Button
              full
              variant="success"
              disabled={dispatching}
              onClick={() => void confirmDispatch()}
            >
              {dispatching ? "Dispatching…" : "Confirm dispatch"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-text2 mb-3">
          This will deduct reserved stock and mark the order as dispatched.
        </p>
      </Modal>

      <Modal
        open={newOpen}
        onClose={() => !saving && setNewOpen(false)}
        title="New sales order"
        actions={
          <>
            <Button full disabled={saving} onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button
              full
              variant="primary"
              disabled={saving}
              onClick={() => void saveNewOrder()}
            >
              {saving ? "Saving…" : "Save order"}
            </Button>
          </>
        }
      >
        <Input
          label="Order no (from AlignBooks)"
          value={newOrderNo}
          onChange={(e) => setNewOrderNo(e.target.value)}
          placeholder="e.g. PE/25-26/0269"
        />
        <Input
          label="Party / customer name"
          value={newParty}
          onChange={(e) => setNewParty(e.target.value)}
        />
        <Input
          label="Due date (optional)"
          type="date"
          value={newDue}
          onChange={(e) => setNewDue(e.target.value)}
        />
        {newItems.length > 0 && (
          <div className="mb-3">
            {newItems.map((i) => (
              <DataRow
                key={i.sku}
                label={i.sku}
                value={`${i.qty_ordered} pcs`}
              />
            ))}
          </div>
        )}
        <div className="grid grid-cols-[2fr_1fr] gap-2 mb-2">
          <input
            className="w-full rounded-[var(--radius)] border border-border2 bg-surface px-3 py-2.5 text-sm"
            placeholder="SKU code"
            value={newItemSku}
            onChange={(e) => setNewItemSku(e.target.value)}
          />
          <input
            className="w-full rounded-[var(--radius)] border border-border2 bg-surface px-3 py-2.5 text-sm"
            placeholder="Qty"
            type="number"
            min={1}
            value={newItemQty}
            onChange={(e) => setNewItemQty(e.target.value)}
          />
        </div>
        <Button sm full onClick={addNewItem}>
          + Add item
        </Button>
      </Modal>
    </div>
  );
}
