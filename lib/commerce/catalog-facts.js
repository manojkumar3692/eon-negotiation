import {z} from 'zod';
const minor=z.number().int().nonnegative().max(100000000);
export const pricingSchema=z.object({regularMinor:minor.nullable(),sellingMinor:minor.refine(n=>n>0),taxBasis:z.enum(['inclusive','exclusive']),source:z.string().min(1).max(200)}).strict().refine(p=>p.regularMinor===null||p.regularMinor>=p.sellingMinor,'Regular price cannot be below selling price');
export const storeTermsSchema=z.object({
 shipping:z.discriminatedUnion('mode',[
  z.object({mode:z.literal('free'),customerChargeMinor:z.literal(0)}).strict(),
  z.object({mode:z.literal('flat'),customerChargeMinor:minor}).strict(),
  z.object({mode:z.literal('threshold'),customerChargeMinor:minor,thresholdMinor:minor.refine(n=>n>0)}).strict(),
  z.object({mode:z.literal('calculated')}).strict(),z.object({mode:z.literal('unknown')}).strict()]),
 promotions:z.object({status:z.enum(['known','unknown']),offers:z.array(z.object({code:z.string().min(1).max(100),description:z.string().min(1).max(500),combinesWithNegotiation:z.enum(['yes','no','unknown']),expiresAt:z.string().datetime().nullable()}).strict()).max(100)}).strict()
}).strict().refine(t=>t.promotions.status==='known'||t.promotions.offers.length===0,'Unknown promotions cannot contain confirmed offers');
export function catalogFacts(item,terms,asOf){
 return {status:item.pricing?'confirmed':'needs_confirmation',pricing:item.pricing||null,storeTerms:terms||null,asOf};
}
export function importReady(product){return product?.commerce_facts?.status==='confirmed'&&product.commerce_facts.pricing?.taxBasis==='inclusive'&&!!product.commerce_facts.storeTerms&&product.commerce_facts.storeTerms.shipping.mode!=='unknown'&&product.commerce_facts.storeTerms.promotions.status==='known';}
