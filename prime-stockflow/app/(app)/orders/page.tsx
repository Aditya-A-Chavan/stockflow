import { Suspense } from "react";
import OrdersPageClient from "./OrdersPageClient";

export default function OrdersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-text2">Loading orders…</p>}>
      <OrdersPageClient />
    </Suspense>
  );
}
