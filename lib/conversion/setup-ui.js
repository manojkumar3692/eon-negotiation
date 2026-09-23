// Merchant-only presentation helpers. No prices or approvals are changed here.
export function ruleIssues(product,rule){
 const issues=[];const price=product.priceMinor;
 if(!Number.isSafeInteger(rule.targetMinor)||rule.targetMinor>price)issues.push('Preferred price exceeds the current selling price.');
 if(!Number.isSafeInteger(rule.floorMinor)||rule.floorMinor<=0||rule.floorMinor>price)issues.push('Protected minimum must be positive and no higher than the current selling price.');
 if(rule.targetMinor<rule.floorMinor)issues.push('Preferred price must be at least the protected minimum.');
 if(!Number.isSafeInteger(rule.costMinor)||rule.costMinor<0)issues.push('Enter your approved product cost.');
 return issues;
}
export function preferredSetupProduct(products,config){
 return products.find(p=>config.products.some(r=>r.id===p.id&&r.enabled))||products[0]||null;
}
export function setupTestProducts(products,config){
 return products.filter(p=>{const rule=config.products.find(r=>r.id===p.id);return rule?.enabled&&!ruleIssues(p,rule).length;});
}
