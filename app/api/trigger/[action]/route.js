import {evaluateInvitation,invitationEvent} from '../../../../lib/conversion/invitations.js';
import {ZodError} from 'zod';
const headers=origin=>({'Access-Control-Allow-Origin':origin,'Vary':'Origin','Cache-Control':'no-store','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});
export async function OPTIONS(request){return new Response(null,{status:204,headers:headers(request.headers.get('origin')||'null')});}
export async function POST(request,{params}){
 const origin=request.headers.get('origin')||'null';
 try{const reader=request.body?.getReader();let size=0;const parts=[];if(!reader)throw Error('INVALID_BODY');while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>10000){await reader.cancel();return Response.json({error:'Request too large'},{status:413,headers:headers(origin)});}parts.push(value);}
 const input=JSON.parse(Buffer.concat(parts).toString('utf8')), {action}=await params;
 const result=action==='evaluate'?await evaluateInvitation(input,origin):action==='events'?await invitationEvent(input,origin):null;
 return Response.json(result||{error:'Not found'},{status:result?200:404,headers:headers(origin)});
 }catch(e){const status=e.message==='ORIGIN_DENIED'?403:e instanceof ZodError||e instanceof SyntaxError||e.message==='INVALID_BODY'?400:503;return Response.json({error:status===403?'Origin not permitted':status===400?'Invalid request':'Temporarily unavailable'},{status,headers:headers(origin)});}
}
