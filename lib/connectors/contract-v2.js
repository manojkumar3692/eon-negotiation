// Shared merchant connector v2 contract. Keep in sync with the reference merchant contract.
import { z } from "zod";
const id = z.string().min(1).max(200);
const minor = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const timestamp = z.string().datetime();
export const bindingSchema = z.object({ tenantId: id, installationId: id }).strict();
const lineSchema = z.object({ productId: id, variantId: id, quantity: z.number().int().min(1).max(20) }).strict();
export const cartSchema = z.object({
    currency: z.string().regex(/^[A-Z]{3}$/),
    lines: z.array(lineSchema).min(1).max(50),
    promotionCodes: z.array(id).max(10),
    paymentMethod: z.enum(["prepaid", "partial_cod", "cod"]),
    destination: z.object({ country: z.string().regex(/^[A-Z]{2}$/), postalCode: z.string().regex(/^[A-Za-z0-9 -]{1,16}$/) }).strict().nullable(),
}).strict().refine(c => new Set(c.lines.map(l => JSON.stringify([l.productId, l.variantId]))).size === c.lines.length, "Duplicate variant lines");
export const requestSchema = z.discriminatedUnion("operation", [
    bindingSchema.extend({ schemaVersion: z.literal("2"), operation: z.literal("capabilities") }).strict(),
    bindingSchema.extend({ schemaVersion: z.literal("2"), operation: z.literal("context"), cart: cartSchema }).strict(),
]);
// A missing value is never represented by zero, an empty object, or guessed data.
export function factSchema(value) {
    const metadata = { source: id, revision: id, asOf: timestamp, expiresAt: timestamp };
    return z.discriminatedUnion("status", [
        z.object({ status: z.enum(["live", "merchant_configured", "derived"]), value, ...metadata }).strict(),
        z.object({ status: z.literal("stale"), value, ...metadata, requirement: id }).strict(),
        z.object({ status: z.literal("unavailable"), value: z.null(), source: id, requirement: id }).strict(),
    ]);
}
const catalogEntry = z.object({ productId: id, variantId: id, name: id, size: id, basePriceMinor: minor }).strict();
const shipping = z.object({
    mode: z.enum(["flat", "zone_table", "live_quote"]), currency: z.string().regex(/^[A-Z]{3}$/),
    serviceable: z.boolean(), merchantCostMinor: minor, customerChargeMinor: minor,
    rateId: id,
}).strict();
const capability = z.enum(["supported", "partial", "unavailable"]);
export const responseSchema = bindingSchema.extend({
    schemaVersion: z.literal("2"), operation: z.enum(["capabilities", "context"]),
    asOf: timestamp, expiresAt: timestamp, revision: id,
    activation: z.literal("blocked"),
    capabilities: z.object({
        catalog: capability, pricing: capability,
        inventory: capability, economics: capability,
        sales: capability, shipping: capability,
        checkout: capability, eventVerification: capability, reconciliation: capability,
    }).strict(),
    facts: z.object({
        catalog: factSchema(z.array(catalogEntry)), currency: factSchema(z.string().regex(/^[A-Z]{3}$/)),
        taxBasis: factSchema(z.enum(["inclusive", "exclusive"])),
        cartFingerprint: factSchema(z.string().regex(/^[a-f0-9]{64}$/)),
        sellingPrice: factSchema(z.object({ currency: z.string().regex(/^[A-Z]{3}$/), subtotalMinor: minor, discountMinor: minor, totalMinor: minor }).strict()),
        inventory: factSchema(z.array(z.object({ variantId: id, availableToSell: z.number().int().nonnegative() }).strict())),
        economics: factSchema(z.array(z.object({ variantId: id, currency: id, approvedFloorMinor: minor }).strict())),
        sales: factSchema(z.array(z.object({ variantId: id, currency: id, taxBasis: z.enum(["inclusive", "exclusive"]), medianUnitMinor: minor, sampleCount: z.number().int().positive(), windowStart: timestamp, windowEnd: timestamp, excludesRefundsBundlesExceptionalPromotions: z.literal(true) }).strict())),
        shipping: factSchema(shipping),
        payment: factSchema(z.object({ method: z.enum(["prepaid", "partial_cod"]), chargeNowMinor: minor, balanceDueMinor: minor, destinationEligibility: z.literal("unverified") }).strict()),
        promotions: factSchema(z.object({ applied: z.array(id), scope: id, excludesPersonalCreditsAndExceptionalPromotions: z.literal(true) }).strict()),
    }).strict(),
    requirements: z.array(id).min(1),
}).strict();
// Validate again at the platform trust boundary, including the expected installation.
export function validateResponse(value, expected, now = Date.now()) {
    const response = responseSchema.parse(value);
    if (response.tenantId !== expected.tenantId || response.installationId !== expected.installationId || response.operation !== expected.operation)
        throw Error("binding_mismatch");
    const fresh = (asOf, expiresAt) => {
        const start = Date.parse(asOf), end = Date.parse(expiresAt);
        if (start > now || end <= now || end <= start || end - start > 60000 || now - start > 60000)
            throw Error("stale_context");
    };
    fresh(response.asOf, response.expiresAt);
    for (const fact of Object.values(response.facts)) {
        if (fact.status !== "unavailable" && fact.status !== "stale")
            fresh(fact.asOf, fact.expiresAt);
    }
    if (expected.operation === "context" && (!expected.fingerprint || response.facts.cartFingerprint.status !== "derived" || response.facts.cartFingerprint.value !== expected.fingerprint))
        throw Error("cart_mismatch");
    return response;
}
