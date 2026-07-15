import { describe, expect, it } from "vitest";
import {
  availableStock,
  computeOrderStatus,
  validateReserveQty,
} from "@/lib/domain/stock";

describe("availableStock", () => {
  it("returns qty minus reserved", () => {
    expect(availableStock(100, 30)).toBe(70);
  });

  it("never returns negative", () => {
    expect(availableStock(10, 20)).toBe(0);
  });
});

describe("computeOrderStatus", () => {
  it("returns open when nothing reserved", () => {
    expect(
      computeOrderStatus([
        { qty_ordered: 10, qty_reserved: 0 },
        { qty_ordered: 5, qty_reserved: 0 },
      ])
    ).toBe("open");
  });

  it("returns partial when some items reserved", () => {
    expect(
      computeOrderStatus([
        { qty_ordered: 10, qty_reserved: 5 },
        { qty_ordered: 5, qty_reserved: 0 },
      ])
    ).toBe("partial");
  });

  it("returns ready when all items fully reserved", () => {
    expect(
      computeOrderStatus([
        { qty_ordered: 10, qty_reserved: 10 },
        { qty_ordered: 5, qty_reserved: 5 },
      ])
    ).toBe("ready");
  });

  it("stays dispatched once dispatched", () => {
    expect(
      computeOrderStatus(
        [{ qty_ordered: 10, qty_reserved: 0 }],
        "dispatched"
      )
    ).toBe("dispatched");
  });
});

describe("validateReserveQty", () => {
  it("rejects over-allocation against available stock", () => {
    expect(validateReserveQty(15, 10, 10)).toBe(
      "Not enough available stock"
    );
  });

  it("rejects reserving more than still needed", () => {
    expect(validateReserveQty(8, 20, 5)).toBe(
      "Cannot reserve more than still needed on order"
    );
  });

  it("accepts valid quantity", () => {
    expect(validateReserveQty(5, 10, 8)).toBeNull();
  });

  it("rejects non-positive quantity", () => {
    expect(validateReserveQty(0, 10, 10)).toBe("Enter a valid quantity");
  });
});
