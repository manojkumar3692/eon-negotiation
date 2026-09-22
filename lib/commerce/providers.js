import {callCustomConnector} from "./custom.js";
import {shopifyCatalog,shopifyCheckout,shopifyContext} from "./shopify.js";

async function persistRefresh(client,installation,refreshed) {
  if(!refreshed)return;
  await client.query("update negotiation.connector_installations set credential_ciphertext=$1,refresh_credential_ciphertext=$2,token_expires_at=$3 where id=$4",[refreshed.accessCiphertext,refreshed.refreshCiphertext,refreshed.expiresAt,installation.id]);
}

export async function providerCapabilities(client,installation) {
  if(installation.provider==="custom")return callCustomConnector(installation,"capabilities");
  if(installation.provider==="shopify")return {schemaVersion:"3",workspaceId:installation.workspace_id,installationId:installation.id,operation:"capabilities",asOf:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),revision:"shopify-adapter-v1",capabilities:{businessModels:["physical_goods"],catalog:true,inventory:true,economics:false,sales:false,shipping:installation.config.shipping?.mode||"none",checkout:true,reconciliation:true,events:true},requirements:["Set a minimum price for each synchronized product.","Configure an approved shipping method before activation."]};
  throw Error("CONNECTOR_PROVIDER_UNSUPPORTED");
}

export async function providerCatalog(client,installation,input={}) {
  if(installation.provider==="custom")return callCustomConnector(installation,"catalog",input);
  if(installation.provider==="shopify") {
    const result=await shopifyCatalog(installation,input);await persistRefresh(client,installation,result.refreshed);return result;
  }
  throw Error("CONNECTOR_PROVIDER_UNSUPPORTED");
}

export async function providerContext(client,installation,cart,platformProduct) {
  if(installation.provider==="custom") {
    const result=await callCustomConnector(installation,"context",{cart});
    if(platformProduct?.floor_minor!=null)result.line.approvedFloorMinor=Math.max(result.line.approvedFloorMinor??0,platformProduct.floor_minor);
    return result;
  }
  if(installation.provider==="shopify") {
    const result=await shopifyContext(installation,cart,platformProduct);await persistRefresh(client,installation,result.refreshed);delete result.refreshed;return result;
  }
  throw Error("CONNECTOR_PROVIDER_UNSUPPORTED");
}

export async function providerCheckout(client,installation,quote,context,idempotencyKey) {
  if(installation.provider==="custom")return callCustomConnector(installation,"checkout",{quote,idempotencyKey});
  if(installation.provider==="shopify") {
    const result=await shopifyCheckout(installation,quote,context);await persistRefresh(client,installation,result.refreshed);
    const now=new Date(),expires=new Date(Math.min(Date.parse(quote.expiresAt),Date.now()+300000));
    return {schemaVersion:"3",workspaceId:installation.workspace_id,installationId:installation.id,operation:"checkout",asOf:now.toISOString(),expiresAt:expires.toISOString(),revision:`shopify-draft:${result.id}`,status:result.status,externalId:result.id,checkoutUrl:result.invoiceUrl};
  }
  throw Error("CONNECTOR_PROVIDER_UNSUPPORTED");
}
