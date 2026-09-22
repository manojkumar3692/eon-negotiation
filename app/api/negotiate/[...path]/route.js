import {ZodError} from "zod";
import {acceptQuote,confirmTarget,customerMessage,startLiveSession} from "../../../../lib/live/service.js";

const response=(body,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
async function body(request){if(Number(request.headers.get("content-length")||0)>20000)throw Error("REQUEST_TOO_LARGE");return request.json();}
export async function POST(request,{params}) {
  try {
    const origin=process.env.APP_ORIGIN||new URL(request.url).origin;if(request.headers.get("origin")!==origin)return response({error:"Origin not permitted"},403);
    const {path}=await params,input=await body(request),auth=request.headers.get("authorization")||"",token=auth.startsWith("Bearer ")?auth.slice(7):"";
    if(path.length===1&&path[0]==="start")return response(await startLiveSession(input),201);
    if(path.length===2&&path[1]==="message")return response(await customerMessage(path[0],token,input.message));
    if(path.length===2&&path[1]==="confirm")return response(await confirmTarget(path[0],token));
    if(path.length===2&&path[1]==="accept")return response(await acceptQuote(path[0],token,input));
    return response({error:"Not found"},404);
  } catch(error) {
    if(error instanceof ZodError||["INVALID_MESSAGE","INVALID_IDEMPOTENCY_KEY","NO_PENDING_TARGET"].includes(error.message))return response({error:"Check the request and try again."},400);
    if(["SESSION_UNAVAILABLE","QUOTE_EXPIRED","CONTEXT_CHANGED","IDEMPOTENCY_MISMATCH"].includes(error.message))return response({error:"This offer is no longer current. Start again."},409);
    if(["NEGOTIATION_DISABLED","NEGOTIATION_UNAVAILABLE"].includes(error.message))return response({error:"Negotiation is not available for this store."},503);
    if(["RATE_LIMIT","MESSAGE_LIMIT"].includes(error.message))return response({error:"Too many requests. Try again later."},429);
    if(error.message==="DAILY_BUDGET_EXHAUSTED")return response({error:"The store has reached today’s offer limit."},409);
    console.error("Negotiation request failed",error.message);return response({error:"The request could not be completed."},503);
  }
}
