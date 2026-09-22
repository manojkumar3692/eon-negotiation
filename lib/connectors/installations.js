import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { tenant } from '../db.js';
import { cartSchema } from './contract-v2.js';
import { assertEndpoint, seal, fetchContext } from './client-v2.js';
const setupSchema = z.object({action:z.literal('connect')}).strict();
const testSchema = z.object({action:z.literal('test'),cart:cartSchema.optional()}).strict();
const shippingSchema = z.object({action:z.literal('shipping'),mode:z.enum(['unconfigured','flat','zone_table','live_quote'])}).strict();
const inputSchema = z.union([setupSchema,testSchema,shippingSchema]);
async function owned(c,id) {
  if(!z.string().uuid().safeParse(id).success) throw Error('NOT_FOUND');
  const {rows:[w]}=await c.query('select id,currency from negotiation.workspaces where id=$1',[id]);
  if(!w)throw Error('NOT_FOUND'); return w;
}
function available(id) {
  return process.env.CONNECTOR_LOCAL_ENABLED==='true' && process.env.NODE_ENV!=='production' && process.env.NEON_BRANCH==='dashboard-onboarding' && process.env.CONNECTOR_LOCAL_WORKSPACE_ID===id;
}
function publicState(row,id) {
  if(!row)return {configured:false,localAvailable:available(id)};
  return {configured:true,id:row.id,status:row.status,endpoint:row.endpoint,lastAttemptAt:row.last_attempt_at,lastSuccessAt:row.last_success_at,error:row.last_error,result:row.last_result,shippingMode:row.shipping_mode};
}
export async function connectorState(user,id) {
  return tenant(user,async c=>{await owned(c,id);const {rows:[row]}=await c.query('select * from negotiation.connector_installations where workspace_id=$1 and connector_kind=$2',[id,'custom']);return publicState(row,id);});
}
export async function connectorAction(user,id,input) {
  const data=inputSchema.parse(input);
  const requestId=randomUUID();
  const row=await tenant(user,async c=>{
    const workspace=await owned(c,id);
    await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[id]);
    if(data.action==='connect') {
      if(!available(id))throw Error('Connector: Local connection has not been provisioned for this workspace.');
      const endpoint=assertEndpoint(process.env.CONNECTOR_LOCAL_ENDPOINT);
      const installId=z.string().uuid().parse(process.env.CONNECTOR_LOCAL_INSTALLATION_ID);
      const token=z.string().regex(/^[A-Za-z0-9_-]{43,128}$/).parse(process.env.CONNECTOR_LOCAL_READ_TOKEN);
      const ciphertext=seal(token,`${id}:${installId}`);
      await c.query("insert into negotiation.connector_installations(id,workspace_id,endpoint,credential_ciphertext) values($1,$2,$3,$4) on conflict(workspace_id,connector_kind) do nothing",[installId,id,endpoint,ciphertext]);
      await c.query("insert into negotiation.audit_events(workspace_id,actor_user_id,name,detail) values($1,$2,'Store connection configured','Read-only local adapter configured; activation remains blocked.')",[id,user]);
    }
    const {rows:[installation]}=await c.query('select * from negotiation.connector_installations where workspace_id=$1 and connector_kind=$2',[id,'custom']);
    if(!installation)throw Error('Connector: Connect the store before testing.');
    if(data.action==='shipping') {
      await c.query('update negotiation.connector_installations set shipping_mode=$1 where id=$2',[data.mode,installation.id]);
      return {...installation,shipping_mode:data.mode};
    }
    if(data.action==='test') {
      if(data.cart && data.cart.currency!==workspace.currency)throw Error('Connector: Cart currency must match the workspace.');
      await c.query('update negotiation.connector_installations set request_id=$1,last_attempt_at=now() where id=$2',[requestId,installation.id]);
    }
    return installation;
  });
  if(data.action!=='test')return publicState(row,id);
  let result=null,error=null;
  try { result=await fetchContext(row,data.cart ? {operation:'context',cart:data.cart} : {operation:'capabilities'}); }
  catch(e) { error=e.message.startsWith('The store') || e.message.startsWith('This endpoint') ? e.message : 'The connection could not be checked. Reconfigure its server credentials.'; }
  return tenant(user,async c=>{
    await owned(c,id);
    // A slower earlier request cannot overwrite the newest attempt.
    const {rows:[updated]}=await c.query("update negotiation.connector_installations set status=$1,last_error=$2,last_result=$3,last_success_at=case when $3::jsonb is not null then now() else last_success_at end where id=$4 and workspace_id=$5 and request_id=$6 returning *",[error?'failed':'read_only',error,result,row.id,id,requestId]);
    if(!updated)throw Error('Connector: A newer test has started. Refresh the connection.');
    await c.query('insert into negotiation.audit_events(workspace_id,actor_user_id,name,detail) values($1,$2,$3,$4)',[id,user,error?'Store check failed':'Store check completed',error || 'Read-only context verified. No offer, order or payment created.']);
    return publicState(updated,id);
  });
}
