import {createHmac,timingSafeEqual} from "node:crypto";
import {seal,unseal} from "../connectors/client-v2.js";
import {fingerprint} from "./custom.js";

export const SHOPIFY_SCOPES=["read_products","read_inventory","read_orders","write_draft_orders"];

export function normalizeShopDomain(value) {
  const host=String(value||"").trim().toLowerCase().replace(/^https?:\/\//,"").replace(/\/$/,"");
  if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(host))throw Error("Enter the store's .myshopify.com domain.");
  return host;
}

export function verifyShopifyOAuth(query,secret) {
  const hmac=query.get("hmac"); if(!hmac||!/^[a-f0-9]{64}$/i.test(hmac))return false;
  const pairs=[];
  for(const [key,value] of query.entries())if(key!=="hmac"&&key!=="signature")pairs.push([key,value]);
  pairs.sort(([a],[b])=>a.localeCompare(b));
  const message=pairs.map(([k,v])=>`${k}=${v}`).join("&");
  const expected=createHmac("sha256",secret).update(message).digest("hex");
  return timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(hmac,"hex"));
}

export function shopifyAuthorizationUrl({shop,state,clientId,redirectUri,scopes=SHOPIFY_SCOPES}) {
  shop=normalizeShopDomain(shop);
  const url=new URL(`https://${shop}/admin/oauth/authorize`);
  url.search=new URLSearchParams({client_id:clientId,scope:scopes.join(","),redirect_uri:redirectUri,state,grant_options:"per-user"}).toString();
  // Remove per-user access: background sync and webhooks require an offline token.
  url.searchParams.delete("grant_options");
  return url.href;
}

export async function exchangeShopifyCode({shop,code,clientId,clientSecret,fetcher=fetch}) {
  shop=normalizeShopDomain(shop);
  const response=await fetcher(`https://${shop}/admin/oauth/access_token`,{method:"POST",redirect:"error",signal:AbortSignal.timeout(10000),headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,code,expiring:"1"})});
  if(!response.ok)throw Error("SHOPIFY_TOKEN_EXCHANGE_FAILED");
  const value=await response.json();
  if(typeof value.access_token!=="string"||typeof value.refresh_token!=="string"||!(Number(value.expires_in)>0))throw Error("SHOPIFY_TOKEN_RESPONSE_INVALID");
  const granted=String(value.scope||"").split(",").filter(Boolean),missing=SHOPIFY_SCOPES.filter(scope=>!granted.includes(scope)&&!(scope.startsWith("read_")&&granted.includes(`write_${scope.slice(5)}`)));
  if(missing.length)throw Error("SHOPIFY_SCOPES_MISSING");
  return value;
}

async function refreshToken(installation,{env=process.env,fetcher=fetch}={}) {
  if(!installation.refresh_credential_ciphertext)throw Error("SHOPIFY_REAUTHORIZE_REQUIRED");
  const refresh=unseal(installation.refresh_credential_ciphertext,`${installation.workspace_id}:${installation.id}:refresh`,env);
  const response=await fetcher(`https://${normalizeShopDomain(installation.shop_domain)}/admin/oauth/access_token`,{method:"POST",redirect:"error",signal:AbortSignal.timeout(10000),headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"refresh_token",client_id:env.SHOPIFY_CLIENT_ID,client_secret:env.SHOPIFY_CLIENT_SECRET,refresh_token:refresh})});
  if(!response.ok)throw Error("SHOPIFY_REAUTHORIZE_REQUIRED");
  const value=await response.json();
  if(typeof value.access_token!=="string"||typeof value.refresh_token!=="string"||!(Number(value.expires_in)>0))throw Error("SHOPIFY_TOKEN_RESPONSE_INVALID");
  return {value,accessCiphertext:seal(value.access_token,`${installation.workspace_id}:${installation.id}`,env),refreshCiphertext:seal(value.refresh_token,`${installation.workspace_id}:${installation.id}:refresh`,env),expiresAt:new Date(Date.now()+Number(value.expires_in)*1000).toISOString()};
}

export async function shopifyToken(installation,options={}) {
  const env=options.env||process.env;
  if(!installation.token_expires_at||Date.parse(installation.token_expires_at)>Date.now()+60000)return {token:unseal(installation.credential_ciphertext,`${installation.workspace_id}:${installation.id}`,env)};
  const refreshed=await refreshToken(installation,options);
  return {token:refreshed.value.access_token,refreshed};
}

export async function shopifyGraphql(installation,query,variables={},options={}) {
  const env=options.env||process.env, fetcher=options.fetcher||fetch;
  const auth=await shopifyToken(installation,{env,fetcher});
  const version=env.SHOPIFY_API_VERSION||"2026-07";
  const response=await fetcher(`https://${normalizeShopDomain(installation.shop_domain)}/admin/api/${version}/graphql.json`,{method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(12000),headers:{"Content-Type":"application/json","X-Shopify-Access-Token":auth.token},body:JSON.stringify({query,variables})});
  if(response.status===401)throw Error("SHOPIFY_REAUTHORIZE_REQUIRED");
  if(!response.ok)throw Error("SHOPIFY_API_UNAVAILABLE");
  const body=await response.json();
  if(body.errors?.length)throw Error("SHOPIFY_GRAPHQL_ERROR");
  return {data:body.data,refreshed:auth.refreshed};
}

function decimalToMinor(value) {
  const text=String(value);
  if(!/^\d+(?:\.\d{1,2})?$/.test(text))throw Error("SHOPIFY_MONEY_INVALID");
  const [whole,fraction=""]=text.split(".");
  const result=Number(whole)*100+Number(fraction.padEnd(2,"0"));
  if(!Number.isSafeInteger(result))throw Error("SHOPIFY_MONEY_INVALID");
  return result;
}
const minorToDecimal=value=>(value/100).toFixed(2);

export async function shopifyCatalog(installation,{cursor=null,limit=50}={},options={}) {
  const query=`query Catalog($first:Int!,$after:String){productVariants(first:$first,after:$after){nodes{id title sku price inventoryQuantity updatedAt product{id title}} pageInfo{hasNextPage endCursor}}}`;
  const {data,refreshed}=await shopifyGraphql(installation,query,{first:limit,after:cursor},options);
  return {items:data.productVariants.nodes.map(v=>({productId:v.product.id,variantId:v.id,sku:v.sku||v.id,name:v.product.title+(v.title&&v.title!=="Default Title"?` · ${v.title}`:""),currency:installation.config.currency,priceMinor:decimalToMinor(v.price),availableToSell:Number.isInteger(v.inventoryQuantity)?Math.max(0,v.inventoryQuantity):null,fulfillmentType:"physical",updatedAt:v.updatedAt})),nextCursor:data.productVariants.pageInfo.hasNextPage?data.productVariants.pageInfo.endCursor:null,refreshed};
}

export async function shopifyContext(installation,cart,platformProduct,options={}) {
  if(cart.lines.length!==1||cart.promotionCodes.length)throw Error("SHOPIFY_CART_UNSUPPORTED");
  const line=cart.lines[0];
  const query=`query Context($id:ID!){productVariant(id:$id){id title price inventoryQuantity updatedAt product{id title}}}`;
  const {data,refreshed}=await shopifyGraphql(installation,query,{id:line.variantId},options);
  const v=data.productVariant;if(!v||v.product.id!==line.productId)throw Error("SHOPIFY_VARIANT_NOT_FOUND");
  const now=new Date(),expires=new Date(now.getTime()+60000),shipping=installation.config.shipping||{mode:"none",merchantCostMinor:0,customerChargeMinor:0,countries:[]};
  const serviceable=shipping.mode==="none"?true:cart.destination?(!shipping.countries?.length||shipping.countries.includes(cart.destination.country)):null;
  return {schemaVersion:"3",workspaceId:installation.workspace_id,installationId:installation.id,operation:"context",asOf:now.toISOString(),expiresAt:expires.toISOString(),revision:`shopify:${v.updatedAt}`,cartFingerprint:fingerprint(cart),currency:cart.currency,taxBasis:installation.config.taxBasis||"inclusive",line:{productId:v.product.id,variantId:v.id,name:v.product.title+(v.title&&v.title!=="Default Title"?` · ${v.title}`:""),quantity:line.quantity,unitPriceMinor:decimalToMinor(v.price),availableToSell:Number.isInteger(v.inventoryQuantity)?Math.max(0,v.inventoryQuantity):null,approvedFloorMinor:platformProduct?.floor_minor??null,fulfillmentType:"physical"},shipping:{mode:shipping.mode||"none",serviceable,merchantCostMinor:shipping.merchantCostMinor??null,customerChargeMinor:shipping.customerChargeMinor??null,rateId:shipping.rateId||"platform-shipping"},sales:null,promotions:{codes:[],stackable:false},payment:{method:cart.paymentMethod,supported:cart.paymentMethod==="prepaid",feeMinor:0},checkoutSupported:true,refreshed};
}

export async function shopifyCheckout(installation,quote,context,options={}) {
  const tag=`negotiation-${quote.id}`;
  const find=`query Existing($query:String!){draftOrders(first:1,query:$query){nodes{id invoiceUrl}}}`;
  const existing=await shopifyGraphql(installation,find,{query:`tag:${tag}`},options);
  if(existing.data.draftOrders.nodes[0])return {...existing.data.draftOrders.nodes[0],status:"already_created",refreshed:existing.refreshed};
  const quantity=quote.cart.lines[0].quantity,baseline=context.line.unitPriceMinor*quantity,discount=baseline-quote.amountMinor;
  if(discount<0)throw Error("SHOPIFY_QUOTE_INVALID");
  const input={lineItems:[{variantId:quote.cart.lines[0].variantId,quantity}],tags:[tag,"AI negotiation"],note:`Negotiated quote ${quote.id}`,customAttributes:[{key:"negotiation_quote_id",value:quote.id}]};
  if(discount>0)input.appliedDiscount={title:"Negotiated offer",description:"Merchant-approved negotiated price",value:minorToDecimal(discount),valueType:"FIXED_AMOUNT"};
  if(quote.shippingMinor>0)input.shippingLine={title:"Shipping",price:minorToDecimal(quote.shippingMinor)};
  const mutation=`mutation Create($input:DraftOrderInput!){draftOrderCreate(input:$input){draftOrder{id invoiceUrl} userErrors{field message}}}`;
  const result=await shopifyGraphql(installation,mutation,{input},options),payload=result.data.draftOrderCreate;
  if(payload.userErrors.length||!payload.draftOrder?.invoiceUrl)throw Error("SHOPIFY_CHECKOUT_FAILED");
  return {...payload.draftOrder,status:"created",refreshed:result.refreshed};
}
