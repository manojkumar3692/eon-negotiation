import { z } from "zod";
import { currencies } from "./connectors.js";
export function normalizeDomain(input) {
  const value = String(input).trim().toLowerCase();
  const u = new URL(value.includes("://") ? value : `https://${value}`);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    u.search ||
    u.hash ||
    (u.pathname !== "/" && u.pathname !== "")
  )
    throw Error("Enter a public store domain, without a path or credentials.");
  const host = u.hostname;
  if (
    /^[0-9.]+$/.test(host) ||
    !host.includes(".") ||
    host.endsWith(".local") ||
    host.endsWith(".localhost") ||
    !host
      .split(".")
      .every((p) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(p))
  )
    throw Error("Enter a public store domain.");
  return host;
}
const money = z.number().int().min(0).max(100000000);
export const companySchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    domain: z
      .string()
      .min(3)
      .max(253)
      .transform((value, ctx) => {
        try {
          return normalizeDomain(value);
        } catch {
          ctx.addIssue({
            code: "custom",
            message:
              "Enter a valid public store domain without a path or credentials.",
          });
          return z.NEVER;
        }
      }),
    industry: z.enum([
      "Retail & ecommerce",
      "Digital products",
      "Services",
      "B2B / wholesale",
      "Other",
    ]),
    currency: z.enum(currencies),
  })
  .strict();
export const productSchema = z
  .object({
    sku: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(150),
    priceMinor: money.refine((v) => v > 0),
    floorMinor: money.refine((v) => v > 0),
    stock: z.number().int().min(0).max(1000000).nullable(),
  })
  .strict()
  .refine((v) => v.floorMinor <= v.priceMinor, {
    message: "Minimum price cannot exceed the selling price.",
  });
export const policySchema = z
  .object({
    maxDiscountBps: z.number().int().min(0).max(5000),
    rounds: z.number().int().min(1).max(5),
    ttlMinutes: z.number().int().min(1).max(60),
    dailyBudgetMinor: money,
    lowStockThreshold: z.number().int().min(0).max(1000),
    lowStockDiscountBps: z.number().int().min(0).max(5000),
    excessStockThreshold: z.number().int().min(1).max(1000000),
    historyEnabled: z.boolean(),
  })
  .strict()
  .refine(
    (v) =>
      v.lowStockDiscountBps <= v.maxDiscountBps &&
      v.excessStockThreshold > v.lowStockThreshold,
    {
      message:
        "Low-stock discount must stay within the maximum, and excess stock must exceed the low-stock threshold.",
    },
  );
export const simulationSchema = z
  .object({
    productId: z.string().uuid(),
    targetMinor: money.refine((v) => v > 0),
    shippingReserveMinor: money,
    round: z.number().int().min(1).max(5),
    stock: z.number().int().min(0).max(1000000).nullable(),
    medianMinor: money.nullable(),
    sampleCount: z.number().int().min(0).max(1000000),
  })
  .strict();
export function parseMoney(value) {
  const text = String(value).trim();
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(text))
    throw Error("Use a positive price with at most two decimals.");
  const [whole, part = ""] = text.split(".");
  return Number(whole) * 100 + Number(part.padEnd(2, "0"));
}
export function parseCatalogCSV(text) {
  if (typeof text !== "string" || text.length > 200000)
    throw Error("CSV must be smaller than 200 KB.");
  const rows = [];
  let row = [],
    value = "",
    quoted = false,
    closed = false;
  for (let i = 0; i <= text.length; i++) {
    const c = text[i] ?? "\n";
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else if (i === text.length) throw Error("Unclosed quoted CSV field.");
      else value += c;
      continue;
    }
    if (c === '"' && !value && !closed) {
      quoted = true;
      continue;
    }
    if (c === "," || c === "\n" || c === "\r") {
      row.push(value);
      value = "";
      closed = false;
      if (c !== ",") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        if (row.some((v) => v.trim())) rows.push(row);
        row = [];
      }
      continue;
    }
    if (closed && c.trim())
      throw Error("Invalid character after quoted CSV field.");
    value += c;
  }
  const header = rows.shift()?.map((x) => x.trim().replace(/^\uFEFF/, ""));
  if (header?.join(",") !== "sku,name,price,floor,stock")
    throw Error("Use columns: sku,name,price,floor,stock.");
  if (rows.length < 1 || rows.length > 200)
    throw Error("Import between 1 and 200 products.");
  const skus = new Set();
  return rows.map((r, i) => {
    if (r.length !== 5) throw Error(`Row ${i + 2}: expected five columns.`);
    if (skus.has(r[0].trim())) throw Error(`Row ${i + 2}: duplicate SKU.`);
    skus.add(r[0].trim());
    const stock = r[4].trim();
    if (stock && !/^\d+$/.test(stock))
      throw Error(`Row ${i + 2}: stock must be a whole number or blank.`);
    return productSchema.parse({
      sku: r[0],
      name: r[1],
      priceMinor: parseMoney(r[2]),
      floorMinor: parseMoney(r[3]),
      stock: stock === "" ? null : Number(stock),
    });
  });
}
