import {getAuth} from "../../../../../lib/auth.js";
import {beginShopifyOAuth} from "../../../../../lib/commerce/shopify-oauth.js";

export async function GET(request) {
  try {
    const {data:session}=await getAuth().getSession();if(!session?.user)return Response.json({error:"Sign in to continue"},{status:401});
    const url=new URL(request.url),workspaceId=url.searchParams.get("workspaceId"),shop=url.searchParams.get("shop");
    return Response.redirect(await beginShopifyOAuth(session.user.id,workspaceId,shop));
  } catch(error) {return Response.json({error:error.message==="NOT_FOUND"?"Workspace not found":"Shopify connection could not be started"},{status:error.message==="NOT_FOUND"?404:400});}
}
