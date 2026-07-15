"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CsvUploader } from "@/components/import/CsvUploader";
import { toast } from "@/components/ui/ToastProvider";
import {
  addSkuManualAction,
  importOrdersFromCsvAction,
  importSkusFromCsvAction,
  importStockFromCsvAction,
} from "@/lib/actions/imports";
import type { ActionResult } from "@/lib/actions/result";
import type { ImportResult } from "@/lib/actions/imports";

function ImportContent() {
  const router = useRouter();
  const [skuCode, setSkuCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [qty, setQty] = useState("");
  const [bin, setBin] = useState("");
  const [ean, setEan] = useState("");
  const [adding, setAdding] = useState(false);

  async function guardedImport(
    fn: (csv: string) => Promise<ActionResult<ImportResult>>,
    csv: string
  ): Promise<ActionResult<ImportResult>> {
    const res = await fn(csv);
    if (!res.success && res.code === "UNAUTHORIZED") {
      router.push("/login?expired=1");
    } else if (res.success) {
      toast.success("Import complete");
    }
    return res;
  }

  async function handleAddSku() {
    if (adding) return;
    setAdding(true);
    const res = await addSkuManualAction({
      skuCode: skuCode.trim(),
      itemName: itemName.trim(),
      qty: parseInt(qty, 10) || 0,
      binLocation: bin.trim(),
      ean: ean.trim(),
    });
    setAdding(false);

    if (!res.success) {
      if (res.code === "UNAUTHORIZED") router.push("/login?expired=1");
      else toast.error(res.error);
      return;
    }

    toast.success(`${skuCode} added`);
    setSkuCode("");
    setItemName("");
    setQty("");
    setBin("");
    setEan("");
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Import data</h1>
      <p className="text-sm text-text2 mb-5">
        Upload CSVs exported from AlignBooks to load SKUs, stock, and sales orders.
      </p>

      <SectionTitle>Step 1 — SKU master</SectionTitle>
      <Card>
        <CsvUploader
          label="SKUs imported"
          hint="CSV needs columns: sku_code, item_name, hsn, uom (optionally ean). Duplicate SKU codes in one file: last row wins."
          onImport={(csv) => guardedImport(importSkusFromCsvAction, csv)}
        />
      </Card>

      <SectionTitle>Step 2 — Current stock</SectionTitle>
      <Card>
        <CsvUploader
          label="stock entries updated"
          hint="CSV needs columns: sku_code, qty_on_hand (optionally bin_location). Unknown SKUs are skipped with a warning."
          onImport={(csv) => guardedImport(importStockFromCsvAction, csv)}
        />
      </Card>

      <SectionTitle>Step 3 — Sales orders</SectionTitle>
      <Card>
        <CsvUploader
          label="orders added"
          hint="CSV needs columns: order_no, party_name, sku_code, qty_ordered (optionally due_date). Existing order numbers are skipped."
          onImport={(csv) => guardedImport(importOrdersFromCsvAction, csv)}
        />
      </Card>

      <SectionTitle>Or add stock manually</SectionTitle>
      <Card>
        <Input
          label="SKU code"
          value={skuCode}
          onChange={(e) => setSkuCode(e.target.value)}
          placeholder="e.g. 3606263"
        />
        <Input
          label="Item name"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2.5">
          <Input
            label="Qty on hand"
            type="number"
            min={0}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <Input
            label="Bin location"
            value={bin}
            onChange={(e) => setBin(e.target.value)}
            placeholder="A-1-B-2"
          />
        </div>
        <Input
          label="EAN / barcode (optional)"
          value={ean}
          onChange={(e) => setEan(e.target.value)}
        />
        <Button variant="primary" full disabled={adding} onClick={() => void handleAddSku()}>
          {adding ? "Adding…" : "Add SKU to stock"}
        </Button>
      </Card>
    </div>
  );
}

export default function ImportPage() {
  return (
    <Suspense fallback={<p className="text-sm text-text2">Loading…</p>}>
      <ImportContent />
    </Suspense>
  );
}
