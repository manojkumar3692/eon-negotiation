import test from "node:test";
import assert from "node:assert/strict";
import { validateContext } from "../lib/connectors/contract.js";
const now = Date.parse("2026-09-21T10:01:00Z");
const context = {
  schemaVersion: "1",
  variantId: "SKU-01",
  currency: "INR",
  quantity: 1,
  priceMinor: 99900,
  priceBasis: "tax_inclusive",
  availableToSell: 40,
  approvedItemFloorMinor: 87500,
  shipping: { serviceable: true, merchantCostMinor: 4500 },
  sales: { comparableMedianMinor: 94900, sampleCount: 12 },
  asOf: "2026-09-21T10:00:00Z",
  expiresAt: "2026-09-21T10:05:00Z",
  revision: "123",
};
const request = { variantId: "SKU-01", currency: "INR", quantity: 1, now };
test("context contract binds exact variant, currency and quantity", () => {
  assert.equal(validateContext(context, request).revision, "123");
  for (const patch of [
    { variantId: "other" },
    { currency: "USD" },
    { quantity: 2 },
    { priceMinor: 12.3 },
    { privateSecret: "must not arrive" },
  ])
    assert.throws(() => validateContext({ ...context, ...patch }, request));
});
test("context contract rejects expired, old and future-dated facts", () => {
  for (const patch of [
    { expiresAt: "2026-09-21T10:01:00Z" },
    { asOf: "2026-09-20T10:00:00Z" },
    { asOf: "2026-09-21T10:02:00Z" },
  ])
    assert.throws(() => validateContext({ ...context, ...patch }, request));
});
