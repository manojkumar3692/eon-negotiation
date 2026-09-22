import { z } from "zod";

const id = z.string().min(1).max(240);
const minor = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const timestamp = z.string().datetime();
const currency = z.string().regex(/^[A-Z]{3}$/);

export const cartSchema = z.object({
  currency,
  lines: z.array(z.object({
    productId: id,
    variantId: id,
    quantity: z.number().int().min(1).max(20),
  }).strict()).length(1),
  promotionCodes: z.array(id).max(10).default([]),
  paymentMethod: z.enum(["prepaid", "partial_cod", "cod"]),
  destination: z.object({
    country: z.string().regex(/^[A-Z]{2}$/),
    postalCode: z.string().min(1).max(24),
  }).strict().nullable(),
}).strict();

const binding = {
  schemaVersion: z.literal("3"),
  workspaceId: z.string().uuid(),
  installationId: z.string().uuid(),
};

export const connectorRequestSchema = z.discriminatedUnion("operation", [
  z.object({...binding, operation:z.literal("capabilities")}).strict(),
  z.object({...binding, operation:z.literal("catalog"), cursor:id.nullable().default(null), limit:z.number().int().min(1).max(100).default(50)}).strict(),
  z.object({...binding, operation:z.literal("context"), cart:cartSchema}).strict(),
  z.object({...binding, operation:z.literal("checkout"), quote:z.object({
    id:z.string().uuid(), cart:cartSchema, amountMinor:minor, shippingMinor:minor,
    currency, expiresAt:timestamp, contextRevision:id,
  }).strict(), idempotencyKey:id}).strict(),
  z.object({...binding, operation:z.literal("reconcile"), externalId:id}).strict(),
]);

const envelope = z.object({
  ...binding,
  operation:z.enum(["capabilities","catalog","context","checkout","reconcile"]),
  asOf:timestamp,
  expiresAt:timestamp,
  revision:id,
}).strict();

export const capabilitiesResponseSchema = envelope.extend({
  operation:z.literal("capabilities"),
  capabilities:z.object({
    businessModels:z.array(z.enum(["physical_goods","digital_goods","services","b2b"])).min(1),
    catalog:z.boolean(), inventory:z.boolean(), economics:z.boolean(), sales:z.boolean(),
    shipping:z.enum(["none","flat","zone_table","live_quote"]),
    checkout:z.boolean(), reconciliation:z.boolean(), events:z.boolean(),
  }).strict(),
  requirements:z.array(id),
}).strict();

export const catalogResponseSchema = envelope.extend({
  operation:z.literal("catalog"),
  items:z.array(z.object({
    productId:id, variantId:id, sku:id, name:id, currency,
    priceMinor:minor.refine(v=>v>0), availableToSell:z.number().int().nonnegative().nullable(),
    fulfillmentType:z.enum(["physical","digital","service"]), updatedAt:timestamp,
  }).strict()).max(100),
  nextCursor:id.nullable(),
}).strict();

export const contextResponseSchema = envelope.extend({
  operation:z.literal("context"),
  cartFingerprint:z.string().regex(/^[a-f0-9]{64}$/),
  currency,
  taxBasis:z.enum(["inclusive","exclusive"]),
  line:z.object({
    productId:id, variantId:id, name:id, quantity:z.number().int().min(1).max(20),
    unitPriceMinor:minor.refine(v=>v>0), availableToSell:z.number().int().nonnegative().nullable(),
    approvedFloorMinor:minor.nullable(), fulfillmentType:z.enum(["physical","digital","service"]),
  }).strict(),
  shipping:z.object({
    mode:z.enum(["none","flat","zone_table","live_quote"]), serviceable:z.boolean().nullable(),
    merchantCostMinor:minor.nullable(), customerChargeMinor:minor.nullable(), rateId:id.nullable(),
  }).strict(),
  sales:z.object({
    medianUnitMinor:minor.refine(v=>v>0), sampleCount:z.number().int().positive(),
    windowStart:timestamp, windowEnd:timestamp,
    excludesRefundsBundlesExceptionalPromotions:z.literal(true),
  }).strict().nullable(),
  promotions:z.object({codes:z.array(id), stackable:z.literal(false)}).strict(),
  payment:z.object({method:z.enum(["prepaid","partial_cod","cod"]), supported:z.boolean(), feeMinor:minor}).strict(),
  checkoutSupported:z.boolean(),
}).strict();

export const checkoutResponseSchema = envelope.extend({
  operation:z.literal("checkout"),
  status:z.enum(["created","already_created"]),
  externalId:id,
  checkoutUrl:z.string().url().startsWith("https://"),
}).strict();

export const reconcileResponseSchema = envelope.extend({
  operation:z.literal("reconcile"),
  externalId:id,
  status:z.enum(["pending","paid","cancelled","refunded"]),
}).strict();

const responseSchemas = {
  capabilities:capabilitiesResponseSchema,
  catalog:catalogResponseSchema,
  context:contextResponseSchema,
  checkout:checkoutResponseSchema,
  reconcile:reconcileResponseSchema,
};

export function validateConnectorResponse(value, expected, now=Date.now()) {
  const parsed=responseSchemas[expected.operation].parse(value);
  if(parsed.workspaceId!==expected.workspaceId || parsed.installationId!==expected.installationId) throw Error("CONNECTOR_BINDING_MISMATCH");
  const start=Date.parse(parsed.asOf), end=Date.parse(parsed.expiresAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>now||end<=now||end<=start||now-start>300000||end-start>300000) throw Error("CONNECTOR_RESPONSE_STALE");
  if(expected.operation==="context" && parsed.cartFingerprint!==expected.cartFingerprint) throw Error("CONNECTOR_CART_MISMATCH");
  return parsed;
}
