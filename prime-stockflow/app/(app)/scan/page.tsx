"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BarcodeScanner } from "@/components/scan/BarcodeScanner";
import { Button } from "@/components/ui/Button";
import { Input, Tabs } from "@/components/ui/Input";
import { Badge, statusBadgeVariant } from "@/components/ui/Badge";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { DataRow } from "@/components/ui/Card";
import { toast } from "@/components/ui/ToastProvider";
import { lookupBarcodeAction, type LookupResult } from "@/lib/actions/lookup";
import { reserveStockAction } from "@/lib/actions/reserve";

export default function ScanPage() {
  const router = useRouter();
  const [tab, setTab] = useState("camera");
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const [reserveOpen, setReserveOpen] = useState(false);
  const [reserveCtx, setReserveCtx] = useState<{
    skuCode: string;
    orderNo: string;
    needed: number;
    available: number;
  } | null>(null);
  const [reserveQty, setReserveQty] = useState(1);
  const [reserving, setReserving] = useState(false);

  const runLookup = useCallback(
    async (code: string) => {
      setLoading(true);
      const res = await lookupBarcodeAction({ code });
      setLoading(false);

      if (!res.success) {
        if (res.code === "UNAUTHORIZED") {
          router.push("/login?expired=1");
          return;
        }
        toast.error(res.error);
        return;
      }

      setResult(res.data);
    },
    [router]
  );

  function openReserve(
    skuCode: string,
    orderNo: string,
    needed: number,
    available: number
  ) {
    const qty = Math.min(needed, available);
    setReserveCtx({ skuCode, orderNo, needed, available });
    setReserveQty(qty);
    setReserveOpen(true);
  }

  async function confirmReserve() {
    if (!reserveCtx || reserving) return;
    setReserving(true);

    const res = await reserveStockAction({
      orderNo: reserveCtx.orderNo,
      skuCode: reserveCtx.skuCode,
      qty: reserveQty,
    });

    setReserving(false);

    if (!res.success) {
      if (res.code === "UNAUTHORIZED") {
        router.push("/login?expired=1");
        return;
      }
      toast.error(res.error);
      return;
    }

    toast.success(`Reserved ${reserveQty} units for ${reserveCtx.orderNo}`);
    setReserveOpen(false);
    startTransition(() => void runLookup(reserveCtx.skuCode));
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Scan barcode</h1>

      <Tabs
        tabs={[
          { id: "camera", label: "Camera scan" },
          { id: "manual", label: "Enter manually" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "camera" ? (
        <>
          <BarcodeScanner
            onDetected={(code) => void runLookup(code)}
            onError={(msg) => {
              toast.error(msg);
              setTab("manual");
            }}
          />
          <p className="text-[13px] text-text2 text-center">
            Point camera at SKU or EAN barcode on carton/item
          </p>
        </>
      ) : (
        <>
          <Input
            label="SKU code or EAN number"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="e.g. 3606263 or 8901234567890"
            inputMode="numeric"
          />
          <Button
            variant="primary"
            full
            disabled={loading}
            onClick={() => void runLookup(manualCode.trim())}
          >
            Look up
          </Button>
        </>
      )}

      {loading && (
        <p className="text-sm text-text2 mt-4 text-center">Looking up…</p>
      )}

      {result && !loading && (
        <div className="mt-4">
          {!result.found ? (
            <div className="rounded-[var(--radius)] border border-warn-border bg-warn-bg p-3.5">
              <div className="text-[15px] font-semibold text-warn mb-1.5">
                SKU not found
              </div>
              <div className="text-sm text-text2">
                Barcode: <strong>{result.code}</strong>
              </div>
              <p className="text-[13px] text-text2 mt-2">
                This barcode is not in your SKU master. Add it on the Import tab.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-[var(--radius)] border border-success-border bg-success-bg p-3.5 mb-3">
                <div className="text-base font-bold mb-1">{result.sku!.item_name}</div>
                <div className="text-[13px] text-text2 mb-3">
                  SKU: {result.sku!.sku_code}
                  {result.sku!.ean ? ` · EAN: ${result.sku!.ean}` : ""}
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center">
                    <div className="text-[22px] font-bold">{result.stock!.qty}</div>
                    <div className="text-[11px] text-text2">On hand</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[22px] font-bold text-warn">
                      {result.stock!.reserved}
                    </div>
                    <div className="text-[11px] text-text2">Reserved</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[22px] font-bold text-success">
                      {result.stock!.available}
                    </div>
                    <div className="text-[11px] text-text2">Available</div>
                  </div>
                </div>
                {result.stock!.bin_location && (
                  <div className="text-[13px] text-text2">
                    Location: <strong>{result.stock!.bin_location}</strong>
                  </div>
                )}
              </div>

              {result.pendingOrders && result.pendingOrders.length > 0 ? (
                <>
                  <SectionTitle>Open orders needing this SKU</SectionTitle>
                  {result.pendingOrders.map((o) => (
                    <Card key={`${o.order_no}-${o.qty_ordered}`} className="mb-2.5">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <div className="font-semibold">{o.order_no}</div>
                          <div className="text-[13px] text-text2">{o.party_name}</div>
                        </div>
                        <Badge variant={statusBadgeVariant(o.status)}>
                          {o.status}
                        </Badge>
                      </div>
                      <div className="text-sm mb-2.5">
                        Need: <strong>{o.still_needed}</strong> more (
                        {o.qty_reserved}/{o.qty_ordered} reserved)
                      </div>
                      {result.stock!.available > 0 ? (
                        <Button
                          sm
                          variant="primary"
                          disabled={pending || reserving}
                          onClick={() =>
                            openReserve(
                              result.code,
                              o.order_no,
                              o.still_needed,
                              result.stock!.available
                            )
                          }
                        >
                          Reserve stock
                        </Button>
                      ) : (
                        <span className="text-[13px] text-danger">
                          No available stock
                        </span>
                      )}
                    </Card>
                  ))}
                </>
              ) : (
                <Card>
                  <p className="text-sm text-text2">
                    No open orders pending for this SKU.
                  </p>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      <Modal
        open={reserveOpen}
        onClose={() => !reserving && setReserveOpen(false)}
        title="Reserve stock"
        actions={
          <>
            <Button full disabled={reserving} onClick={() => setReserveOpen(false)}>
              Cancel
            </Button>
            <Button
              full
              variant="primary"
              disabled={reserving}
              onClick={() => void confirmReserve()}
            >
              {reserving ? "Reserving…" : "Reserve"}
            </Button>
          </>
        }
      >
        {reserveCtx && result?.sku && (
          <>
            <DataRow label="Item" value={result.sku.item_name} />
            <DataRow label="Order" value={reserveCtx.orderNo} />
            <DataRow label="Still needed" value={reserveCtx.needed} />
            <DataRow
              label="Available"
              value={reserveCtx.available}
              valueClassName="text-success"
            />
            <Input
              label="Qty to reserve"
              type="number"
              min={1}
              max={Math.min(reserveCtx.needed, reserveCtx.available)}
              value={reserveQty}
              onChange={(e) => setReserveQty(parseInt(e.target.value, 10) || 0)}
            />
          </>
        )}
      </Modal>
    </div>
  );
}
