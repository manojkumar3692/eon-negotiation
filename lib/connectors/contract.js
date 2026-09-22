// Design scaffold for adapter validation. No network client or signature verifier
// is implemented here. Parsing alone does not authenticate a merchant source.
import { z } from "zod";
import { currencies } from "../connectors.js";
const money = z.number().int().min(0).max(100000000);
export const capabilitiesSchema = z
  .object({
    schemaVersion: z.literal("1"),
    capabilities: z.array(
      z.enum([
        "catalog",
        "inventory",
        "shipping",
        "sales_history",
        "checkout",
        "reconciliation",
      ]),
    ),
  })
  .strict();
export const contextSchema = z
  .object({
    schemaVersion: z.literal("1"),
    variantId: z.string().min(1).max(200),
    currency: z.enum(currencies),
    quantity: z.number().int().min(1).max(1000),
    priceMinor: money.refine((n) => n > 0),
    priceBasis: z.enum(["tax_inclusive", "tax_exclusive"]),
    availableToSell: z.number().int().min(0).max(1000000).nullable(),
    approvedItemFloorMinor: money.refine((n) => n > 0),
    shipping: z
      .object({ serviceable: z.boolean(), merchantCostMinor: money })
      .strict()
      .nullable(),
    sales: z
      .object({
        comparableMedianMinor: money,
        sampleCount: z.number().int().min(0),
      })
      .strict()
      .nullable(),
    asOf: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    revision: z.string().min(1).max(200),
  })
  .strict()
  .refine((c) => c.approvedItemFloorMinor <= c.priceMinor, {
    message: "Approved minimum exceeds the current selling price.",
  });
export function validateContext(
  value,
  { variantId, currency, quantity, now = Date.now(), maxAgeMs = 300000 },
) {
  const c = contextSchema.parse(value);
  if (
    c.variantId !== variantId ||
    c.currency !== currency ||
    c.quantity !== quantity
  )
    throw Error(
      "Context does not match the requested item, currency and quantity.",
    );
  const asOf = Date.parse(c.asOf),
    expires = Date.parse(c.expiresAt);
  if (asOf > now || now - asOf > maxAgeMs || expires <= now || expires <= asOf)
    throw Error("Context is stale, expired or future-dated.");
  return c;
}
