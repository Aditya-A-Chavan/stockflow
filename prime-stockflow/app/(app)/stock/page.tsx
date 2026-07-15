"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { searchStockAction, type StockListItem } from "@/lib/actions/stock";

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function StockPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<StockListItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await searchStockAction({
      query: debouncedQuery,
      page,
      pageSize: 50,
    });
    setLoading(false);

    if (!res.success) {
      if (res.code === "UNAUTHORIZED") {
        router.push("/login?expired=1");
        return;
      }
      setError(res.error);
      return;
    }

    setItems(res.data.items);
    setTotalPages(res.data.totalPages);
  }, [debouncedQuery, page, router]);

  useEffect(() => {
    startTransition(() => void load());
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-3.5">Stock</h1>

      <div className="relative mb-3.5">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search SKU or name..."
          className="w-full rounded-[var(--radius)] border border-border2 bg-surface py-2.5 pl-10 pr-3 text-sm outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-bg"
        />
      </div>

      {loading && <p className="text-sm text-text2">Loading stock…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <EmptyState message="No SKUs found. Import or add on the Import tab." />
      )}

      {items.map((item) => {
        const chipClass =
          item.available === 0
            ? "bg-danger-bg text-danger"
            : item.available < 10
              ? "bg-warn-bg text-warn"
              : "bg-success-bg text-success";

        return (
          <Card key={item.sku_code} className="py-3 px-3.5 mb-2">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm truncate">{item.item_name}</div>
                <div className="text-xs text-text2 mt-0.5">
                  SKU: {item.sku_code}
                  {item.bin_location ? ` · ${item.bin_location}` : ""}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${chipClass}`}
                >
                  {item.available} avail
                </span>
                <div className="text-[11px] text-text3 mt-0.5">
                  {item.reserved} reserved
                </div>
              </div>
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
    </div>
  );
}
