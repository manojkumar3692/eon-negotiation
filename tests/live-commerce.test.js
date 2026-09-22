import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {validateConnectorResponse} from "../lib/commerce/contract.js";
import {callCustomConnector,fingerprint,validateCustomEndpoint,verifyConnectorSignature} from "../lib/commerce/custom.js";
import {seal} from "../lib/connectors/client-v2.js";
import {decideLiveOffer} from "../lib/live/rules.js";
import {numericTarget} from "../lib/live/ai.js";
import {normalizeShopDomain,shopifyAuthorizationUrl,verifyShopifyOAuth} from "../lib/commerce/shopify.js";
import {createConnectorHandler} from "../lib/connector-kit/index.js";

const now=Date.parse("2026-09-22T12:00:00.000Z"),workspaceId="11111111-1111-4111-8111-111111111111",installationId="22222222-2222-4222-8222-222222222222";
const env={NODE_ENV:"production",CONNECTOR_ENCRYPTION_KEY:"a".repeat(64)};
const cart={currency:"INR",lines:[{productId:"product-1",variantId:"variant-1",quantity:1}],promotionCodes:[],paymentMethod:"prepaid",destination:{country:"IN",postalCode:"600001"}};
const envelope=operation=>({schemaVersion:"3",workspaceId,installationId,operation,asOf:new Date(now-1000).toISOString(),expiresAt:new Date(now+59000).toISOString(),revision:"rev-1"});

test("custom endpoints stay on the verified company domain and public network",async()=>{
  const publicResolver=async()=>[{address:"8.8.8.8",family:4}];
  assert.equal(await validateCustomEndpoint("https://api.example.com/negotiation/v3","example.com",{env,resolver:publicResolver}),"https://api.example.com/negotiation/v3");
  await assert.rejects(validateCustomEndpoint("https://attacker.example/negotiation/v3","example.com",{env,resolver:publicResolver}));
  await assert.rejects(validateCustomEndpoint("https://api.example.com/negotiation/v3","example.com",{env,resolver:async()=>[{address:"127.0.0.1",family:4}]}));
});

test("signed custom requests bind tenant, installation, cart and response freshness",async()=>{
  const secret="x".repeat(43),installation={id:installationId,workspace_id:workspaceId,workspace_domain:"example.com",endpoint:"https://api.example.com/negotiation/v3",credential_ciphertext:seal(secret,`${workspaceId}:${installationId}`,env)};
  const response={...envelope("context"),cartFingerprint:fingerprint(cart),currency:"INR",taxBasis:"inclusive",line:{productId:"product-1",variantId:"variant-1",name:"Test",quantity:1,unitPriceMinor:99900,availableToSell:10,approvedFloorMinor:74900,fulfillmentType:"physical"},shipping:{mode:"flat",serviceable:true,merchantCostMinor:5000,customerChargeMinor:5000,rateId:"flat-in"},sales:null,promotions:{codes:[],stackable:false},payment:{method:"prepaid",supported:true,feeMinor:0},checkoutSupported:true};
  const value=await callCustomConnector(installation,"context",{cart},{env,now:()=>now,resolver:async()=>[{address:"8.8.8.8",family:4}],fetcher:async(_url,request)=>{
    const body=request.body,timestamp=request.headers["X-Negotiation-Timestamp"],nonce=request.headers["X-Negotiation-Nonce"],signature=request.headers["X-Negotiation-Signature"];
    assert.equal(request.redirect,"error");assert.equal(request.headers.Authorization,`Bearer ${secret}`);assert.equal(verifyConnectorSignature(secret,{timestamp,nonce,body,signature,now}),true);assert.equal(JSON.parse(body).workspaceId,workspaceId);return Response.json(response);
  }});
  assert.equal(value.line.approvedFloorMinor,74900);
  assert.throws(()=>validateConnectorResponse({...response,installationId:"33333333-3333-4333-8333-333333333333"},{operation:"context",workspaceId,installationId,cartFingerprint:fingerprint(cart)},now));
});

test("live rules preserve floors, shipping economics and stock guardrails",()=>{
  const context={...envelope("context"),cartFingerprint:fingerprint(cart),currency:"INR",taxBasis:"inclusive",line:{productId:"product-1",variantId:"variant-1",name:"Test",quantity:1,unitPriceMinor:99900,availableToSell:40,approvedFloorMinor:74900,fulfillmentType:"physical"},shipping:{mode:"flat",serviceable:true,merchantCostMinor:8000,customerChargeMinor:3000,rateId:"flat"},sales:{medianUnitMinor:90000,sampleCount:5,windowStart:"2026-08-01T00:00:00.000Z",windowEnd:"2026-09-01T00:00:00.000Z",excludesRefundsBundlesExceptionalPromotions:true},promotions:{codes:[],stackable:false},payment:{method:"prepaid",supported:true,feeMinor:1000},checkoutSupported:true};
  const policy={maxDiscountBps:2050,rounds:3,lowStockThreshold:3,lowStockDiscountBps:200,excessStockThreshold:30,historyEnabled:true};
  const decision=decideLiveOffer(context,policy,84915,3);
  assert.ok(decision.amountMinor>=85500);assert.ok(decision.amountMinor>=context.line.approvedFloorMinor+6000);assert.ok(decision.amountMinor<=99900);
  assert.equal(decideLiveOffer({...context,line:{...context.line,availableToSell:0}},policy,90000,1).status,"unavailable");
});

test("numeric offers use exact minor units and reject prose",()=>{
  assert.equal(numericTarget("₹849.15"),84915);assert.equal(numericTarget("900"),90000);assert.equal(numericTarget("Can you do 900?"),null);
});

test("Shopify OAuth helpers restrict shop domains and validate callback HMAC",()=>{
  assert.equal(normalizeShopDomain("https://demo-store.myshopify.com/"),"demo-store.myshopify.com");assert.throws(()=>normalizeShopDomain("shop.example.com"));
  const query=new URLSearchParams({code:"abc",shop:"demo-store.myshopify.com",state:"state-1",timestamp:"123"}),message=[...query.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join("&"),secret="secret";
  query.set("hmac",createHmac("sha256",secret).update(message).digest("hex"));assert.equal(verifyShopifyOAuth(query,secret),true);query.set("code","changed");assert.equal(verifyShopifyOAuth(query,secret),false);
  const auth=new URL(shopifyAuthorizationUrl({shop:"demo-store.myshopify.com",state:"s",clientId:"client",redirectUri:"https://platform.example/callback"}));assert.equal(auth.hostname,"demo-store.myshopify.com");assert.equal(auth.searchParams.get("scope").includes("write_draft_orders"),true);
});

test("reference merchant handler verifies signatures and persists replay claims",async()=>{
  const secret="s".repeat(43),claimed=new Set(),handler=createConnectorHandler({workspaceId,installationId,secret,now:()=>now,claimNonce:async nonce=>{if(claimed.has(nonce))return false;claimed.add(nonce);return true;},capabilities:async()=>({businessModels:["physical_goods"],catalog:true,inventory:true,economics:true,sales:false,shipping:"flat",checkout:true,reconciliation:true,events:true}),listCatalog:async()=>({items:[],nextCursor:null}),getContext:async()=>{throw Error("unused")},createCheckout:async()=>{throw Error("unused")},reconcile:async()=>{throw Error("unused")}});
  const body=JSON.stringify({schemaVersion:"3",workspaceId,installationId,operation:"capabilities"}),timestamp=String(now),nonce="nonce-1",signature=createHmac("sha256",secret).update(`${timestamp}\n${nonce}\n${body}`).digest("hex"),request=()=>new Request("https://api.example.com/negotiation/v3",{method:"POST",headers:{Authorization:`Bearer ${secret}`,"Content-Type":"application/json","X-Negotiation-Timestamp":timestamp,"X-Negotiation-Nonce":nonce,"X-Negotiation-Signature":signature},body});
  const first=await handler(request());assert.equal(first.status,200);assert.equal((await first.json()).capabilities.checkout,true);
  assert.equal((await handler(request())).status,409);
});
