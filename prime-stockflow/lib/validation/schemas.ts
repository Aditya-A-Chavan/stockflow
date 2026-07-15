import { z } from "zod";

export const quantitySchema = z
  .number()
  .int("Quantity must be a whole number")
  .min(1, "Quantity must be at least 1")
  .max(1_000_000, "Quantity exceeds maximum allowed (1,000,000)");

export const skuCodeSchema = z
  .string()
  .trim()
  .min(1, "SKU code is required")
  .max(100, "SKU code is too long");

export const orderNoSchema = z
  .string()
  .trim()
  .min(1, "Order number is required")
  .max(100, "Order number is too long");

export const partyNameSchema = z
  .string()
  .trim()
  .min(1, "Party name is required")
  .max(200, "Party name is too long");

export const dueDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD")
  .optional()
  .or(z.literal(""));

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const reserveSchema = z.object({
  orderNo: orderNoSchema,
  skuCode: skuCodeSchema,
  qty: quantitySchema,
});

export const dispatchSchema = z.object({
  orderNo: orderNoSchema,
});

export const createOrderSchema = z.object({
  orderNo: orderNoSchema,
  partyName: partyNameSchema,
  dueDate: dueDateSchema,
  items: z
    .array(
      z.object({
        skuCode: skuCodeSchema,
        qtyOrdered: quantitySchema,
      })
    )
    .min(1, "Add at least one item"),
});

export const addSkuSchema = z.object({
  skuCode: skuCodeSchema,
  itemName: z.string().trim().min(1, "Item name is required").max(300),
  qty: z.number().int().min(0).max(1_000_000),
  binLocation: z.string().trim().max(100).optional(),
  ean: z.string().trim().max(50).optional(),
});

export const lookupSchema = z.object({
  code: z.string().trim().min(1, "Enter a barcode or SKU code"),
});

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const ordersFilterSchema = paginationSchema.extend({
  filter: z.enum(["all", "open", "ready", "done"]).default("all"),
});

export const stockSearchSchema = paginationSchema.extend({
  query: z.string().trim().max(200).default(""),
});
