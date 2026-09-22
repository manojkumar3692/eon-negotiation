import {finishShopifyOAuth} from "../../../../../lib/commerce/shopify-oauth.js";

export async function GET(request) {
  const origin=process.env.APP_ORIGIN||new URL(request.url).origin;
  try {const workspaceId=await finishShopifyOAuth(new URL(request.url));return Response.redirect(`${origin}/dashboard?workspace=${encodeURIComponent(workspaceId)}&shopify=connected`);}
  catch{return Response.redirect(`${origin}/dashboard?shopify=failed`);}
}
