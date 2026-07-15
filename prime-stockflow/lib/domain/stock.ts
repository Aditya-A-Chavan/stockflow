export type OrderStatus = "open" | "partial" | "ready" | "dispatched";

export interface OrderItemLike {
  qty_ordered: number;
  qty_reserved: number;
}

/** Available units = max(0, qty - reserved). */
export function availableStock(qty: number, reserved: number): number {
  return Math.max(0, qty - reserved);
}

/** Recompute order status from line items (matches prototype rules). */
export function computeOrderStatus(
  items: OrderItemLike[],
  currentStatus?: OrderStatus
): OrderStatus {
  if (currentStatus === "dispatched") {
    return "dispatched";
  }

  if (items.length === 0) {
    return "open";
  }

  const allReserved = items.every((i) => i.qty_reserved >= i.qty_ordered);
  if (allReserved) {
    return "ready";
  }

  const anyReserved = items.some((i) => i.qty_reserved > 0);
  if (anyReserved) {
    return "partial";
  }

  return "open";
}

/** Validate reserve quantity against available stock and order need. */
export function validateReserveQty(
  qty: number,
  available: number,
  stillNeeded: number
): string | null {
  if (!Number.isInteger(qty) || qty <= 0) {
    return "Enter a valid quantity";
  }
  if (qty > 1_000_000) {
    return "Quantity exceeds maximum allowed (1,000,000)";
  }
  if (qty > available) {
    return "Not enough available stock";
  }
  if (qty > stillNeeded) {
    return "Cannot reserve more than still needed on order";
  }
  return null;
}
