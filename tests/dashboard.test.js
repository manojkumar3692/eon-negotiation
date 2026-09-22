import test from "node:test";
import assert from "node:assert/strict";
import {
  companySchema,
  parseMoney,
  parseCatalogCSV,
  policySchema,
} from "../lib/validation.js";
import { defaults } from "../lib/connectors.js";
import { simulate } from "../lib/simulate.js";
const company = {
  name: "Test company",
  domain: "https://EXAMPLE.com/",
  industry: "Retail & ecommerce",
  currency: "USD",
};
test("public company domains normalize, invalid destinations and unsupported currency fail", () => {
  assert.equal(companySchema.parse(company).domain, "example.com");
  for (const domain of [
    "localhost",
    "127.0.0.1",
    "https://[::1]",
    "https://example.com/path",
    "https://user:pass@example.com",
    "http://example.com",
    "not a domain",
  ])
    assert.equal(
      companySchema.safeParse({ ...company, domain }).success,
      false,
    );
  assert.equal(
    companySchema.safeParse({ ...company, currency: "JPY" }).success,
    false,
  );
});
test("money parsing preserves minor units and rejects ambiguous or fractional precision", () => {
  assert.equal(parseMoney("19.09"), 1909);
  for (const v of ["-1", "1.999", "1e3", "1,000", "NaN", ""])
    assert.throws(() => parseMoney(v));
});
test("CSV accepts quoted commas, escaped quotes, line breaks and unknown stock", () => {
  const rows = parseCatalogCSV(
    'sku,name,price,floor,stock\r\nA,"Bag, large",49.00,39.01,12\r\nB,"A ""special""\nitem",20,10,\r\n',
  );
  assert.equal(rows[0].name, "Bag, large");
  assert.equal(rows[0].floorMinor, 3901);
  assert.equal(rows[1].name, 'A "special"\nitem');
  assert.equal(rows[1].stock, null);
});
test("CSV rejects duplicates, invalid minimums, malformed rows and oversized import", () => {
  const head = "sku,name,price,floor,stock\n";
  for (const rows of [
    "A,Thing,1,2,1",
    "A,Thing,2,1,-1",
    "A,Thing,2,1,1\nA,Other,2,1,1",
    'A,"Unclosed,2,1,1',
    "A,Thing,2,1,1,extra",
  ])
    assert.throws(() => parseCatalogCSV(head + rows));
  assert.throws(() => parseCatalogCSV(head + "a".repeat(200001)));
});
test("policy rejects invalid inventory and discount boundaries", () => {
  assert.equal(
    policySchema.safeParse({
      ...defaults,
      lowStockDiscountBps: defaults.maxDiscountBps + 1,
    }).success,
    false,
  );
  assert.equal(
    policySchema.safeParse({
      ...defaults,
      excessStockThreshold: defaults.lowStockThreshold,
    }).success,
    false,
  );
});
const p = { priceMinor: 10000, floorMinor: 8000 };
const input = {
  targetMinor: 7500,
  stock: 40,
  round: 3,
  shippingReserveMinor: 0,
  medianMinor: null,
  sampleCount: 0,
};
test("scenario preserves floors, cap, inventory, shipping and qualified history", () => {
  assert.equal(simulate(p, defaults, input).amountMinor, 9000);
  assert.ok(simulate(p, defaults, { ...input, stock: 1 }).amountMinor >= 9800);
  assert.equal(
    simulate(p, defaults, { ...input, shippingReserveMinor: 1500 }).amountMinor,
    9500,
  );
  assert.equal(
    simulate(
      p,
      { ...defaults, historyEnabled: true },
      { ...input, medianMinor: 10000, sampleCount: 5 },
    ).amountMinor,
    9500,
  );
  assert.equal(
    simulate(
      p,
      { ...defaults, historyEnabled: true },
      { ...input, medianMinor: 10000, sampleCount: 4 },
    ).amountMinor,
    9000,
  );
  for (const stock of [0, null])
    assert.equal(
      simulate(p, defaults, { ...input, stock }).status,
      "unavailable",
    );
  assert.equal(
    simulate(p, defaults, { ...input, round: 4 }).status,
    "unavailable",
  );
  assert.equal(
    simulate(p, defaults, { ...input, shippingReserveMinor: 3000 }).status,
    "unavailable",
  );
  assert.equal(
    simulate(p, { ...defaults, dailyBudgetMinor: 1 }, input).status,
    "unavailable",
  );
});
test("scenario sweep never exceeds list, breaches floor or returns fractional money", () => {
  for (let price = 101; price < 10000; price += 173)
    for (let floor = 1; floor <= price; floor += 137)
      for (const stock of [1, 10, 100]) {
        const result = simulate(
          { priceMinor: price, floorMinor: floor },
          defaults,
          { ...input, stock, targetMinor: Math.floor(price * 0.7) },
        );
        if (result.status === "unavailable") continue;
        assert.ok(Number.isInteger(result.amountMinor));
        assert.ok(result.amountMinor >= floor);
        assert.ok(result.amountMinor >= Math.ceil(price * 0.9));
        assert.ok(result.amountMinor <= price);
      }
});
