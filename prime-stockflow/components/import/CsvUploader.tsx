"use client";

import { useCallback, useState } from "react";
import Papa from "papaparse";
import { stripBom } from "@/lib/csv/parsers";
import type { ActionResult } from "@/lib/actions/result";
import type { ImportResult } from "@/lib/actions/imports";
import { Badge } from "@/components/ui/Badge";

interface CsvUploaderProps {
  label: string;
  hint: string;
  onImport: (csvText: string) => Promise<ActionResult<ImportResult>>;
}

export function CsvUploader({ label, hint, onImport }: CsvUploaderProps) {
  const [status, setStatus] = useState<"idle" | "parsing" | "importing">("idle");
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
    warnings?: string[];
  } | null>(null);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setResult(null);
      setStatus("parsing");

      const text = stripBom(await file.text());

      await new Promise<void>((resolve) => {
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: () => resolve(),
        });
      });

      setStatus("importing");
      const res = await onImport(text);

      if (!res.success) {
        setResult({ type: "error", message: res.error ?? "Import failed" });
      } else {
        const d = res.data;
        let message = `✓ ${d.imported} ${label}`;
        if (d.skipped) message += ` (${d.skipped} skipped)`;
        setResult({
          type: "success",
          message,
          warnings: d.warnings,
        });
      }

      setStatus("idle");
    },
    [label, onImport]
  );

  return (
    <div>
      <p className="text-[13px] text-text2 mb-3">{hint}</p>
      <input
        type="file"
        accept=".csv,text/csv"
        disabled={status !== "idle"}
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        className="text-sm w-full"
      />
      {status !== "idle" && (
        <p className="text-sm text-text2 mt-2">
          {status === "parsing" ? "Parsing CSV…" : "Importing…"}
        </p>
      )}
      {result && (
        <div className="mt-2.5 space-y-2">
          <Badge variant={result.type === "success" ? "green" : "red"}>
            {result.message}
          </Badge>
          {result.warnings?.map((w) => (
            <p key={w} className="text-xs text-warn">
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
