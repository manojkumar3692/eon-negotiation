// Disabled rules retain merchant-approved amounts for later review; never lower floors silently.
// Ownership must still be checked, even when a product is disabled.
export function validateProductRuleAgainstCatalog(rule, product) {
 if (!product) throw Error('NOT_FOUND');
 if (rule.enabled && (rule.targetMinor > product.price_minor || rule.floorMinor > product.price_minor)) {
  throw Error(`Conversion: ${product.name || 'This product'}: preferred price and protected minimum cannot exceed its current catalog selling price. Review its limits before enabling negotiation.`);
 }
}
