import {createHash,randomBytes} from 'node:crypto';
import {z} from 'zod';
import {service} from '../db.js';
import {unseal} from '../connectors/client-v2.js';
import {importReady} from '../commerce/catalog-facts.js';
import {eligibility} from '../../modules/trigger/index.js';
import {recordEvent} from '../../modules/analytics/index.js';
export const digest=value=>createHash('sha256').update(value).digest('hex');
const visitor=z.string().regex(/^[a-zA-Z0-9_-]{16,100}$/);
export const triggerInput=z.object({publicKey:z.string().uuid(),productId:z.string().min(1).max(240),variantId:z.string().min(1).max(240),visitorId:visitor,surface:z.enum(['product','chat','cart','exit_intent']),testerToken:z.string().max(3000).optional(),signals:z.object({visits:z.number().int().min(0).max(100),dwellSeconds:z.number().int().min(0).max(3600),inCart:z.boolean().default(false),checkoutHesitation:z.boolean().default(false)}).strict()}).strict();
export function storeOrigin(origin,domain){try{const u=new URL(origin);return u.protocol==='https:'&&!u.port&&u.origin===origin&&u.hostname.replace(/^www\./,'')===domain.replace(/^www\./,'');}catch{return false;}}
export function testerAllowed(token,workspaceId,productId,version,env=process.env,now=Date.now()){
 try{const t=JSON.parse(unseal(token,`tester:${workspaceId}`,env));return t.productId===productId&&t.version===version&&t.expiresAt>now&&t.expiresAt<=now+3600000;}catch{return false;}
}
async function connection(c,key,origin){const {rows:[row]}=await c.query(`select i.*,w.domain,s.version,s.config as conversion_config,s.status as conversion_status from negotiation.connector_installations i join negotiation.workspaces w on w.id=i.workspace_id left join negotiation.conversion_settings s on s.workspace_id=i.workspace_id where i.public_key=$1 and i.revoked_at is null`,[key]);if(!row||!storeOrigin(origin,row.domain))throw Error('ORIGIN_DENIED');return row;}
async function rate(c,wid,key,max){const {rows:[r]}=await c.query(`insert into negotiation.rate_buckets(workspace_id,bucket_key,window_start,request_count) values($1,$2,date_trunc('minute',now()),1) on conflict(workspace_id,bucket_key,window_start) do update set request_count=negotiation.rate_buckets.request_count+1 returning request_count`,[wid,key]);return r.request_count<=max;}
export async function evaluateInvitation(raw,origin){const input=triggerInput.parse(raw);return service(async c=>{
 const i=await connection(c,input.publicKey,origin),config=i.conversion_config;
 if(process.env.NEGOTIATION_ENABLED!=='true'||i.activation_status!=='active'||i.status!=='ready'||i.conversion_status!=='active')return {eligible:false};
 const vk=digest(i.workspace_id+':'+input.visitorId);
 if(!await rate(c,i.workspace_id,'trigger-all',300)||!await rate(c,i.workspace_id,'trigger:'+vk,12))return {eligible:false,retryAfter:60};
 const {rows:[p]}=await c.query('select * from negotiation.products where workspace_id=$1 and external_product_id=$2 and external_variant_id=$3',[i.workspace_id,input.productId,input.variantId]);
 const rule=config.products.find(r=>r.id===p?.id);
 if(!p||!importReady(p)||!rule?.enabled||rule.costMinor===null||!config.surfaces[input.surface])return {eligible:false};
 const tester=(config.audience||'testers')==='testers';
 if(tester&&!testerAllowed(input.testerToken,i.workspace_id,p.id,i.version))return {eligible:false};
 const {rows:[prior]}=await c.query(`select 1 from negotiation.invitations where workspace_id=$1 and visitor_key=$2 and (shown_at is not null or dismissed_at is not null or consumed_at is not null) and created_at>now()-$3*interval '1 hour' union all select 1 from negotiation.live_sessions where workspace_id=$1 and visitor_key=$2 and created_at>now()-$3*interval '1 hour' limit 1`,[i.workspace_id,vk,config.triggers.cooldownHours]);
 const arm=tester?'tester':parseInt(digest(vk+':'+i.version).slice(0,8),16)%10000<config.experiment.treatmentBps?'treatment':'control';
 const mode=tester?'sandbox':'live';
 const signals={...input.signals,stock:p.stock,newLaunch:rule.newLaunch,cooldown:!!prior,cartMinor:input.signals.inCart?p.price_minor:0,experimentArm:arm};
 const decision=eligibility(signals,config.triggers);
 await recordEvent(c,{workspaceId:i.workspace_id,eventKey:`assignment:${i.version}:${vk}:${mode}`,type:'experiment_assigned',mode,visitorKey:vk,properties:{reasonCode:arm,policyVersion:i.version}});
 await recordEvent(c,{workspaceId:i.workspace_id,eventKey:`eligibility:${randomBytes(16).toString('hex')}`,type:'eligibility_evaluated',mode,visitorKey:vk,properties:{reasonCode:decision.state,surface:input.surface}});
 if(decision.state==='no_negotiation')return {eligible:false};
 const token=randomBytes(32).toString('base64url');
 const {rows:[invite]}=await c.query(`insert into negotiation.invitations(workspace_id,installation_id,product_id,visitor_key,token_hash,settings_version,surface,signals,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '10 minutes') returning expires_at`,[i.workspace_id,i.id,p.id,vk,digest(token),i.version,input.surface,{...input.signals,tester}]);
 return {eligible:true,invitationToken:token,expiresAt:invite.expires_at,presentation:{title:'Still deciding?',message:'Ask us about a better price.',button:'Make an offer'}};
 });}
export async function invitationEvent(raw,origin){const v=z.object({publicKey:z.string().uuid(),invitationToken:z.string().regex(/^[A-Za-z0-9_-]{43}$/),event:z.enum(['shown','dismissed'])}).strict().parse(raw);return service(async c=>{
 const i=await connection(c,v.publicKey,origin);
 const {rows:[inv]}=await c.query(`select * from negotiation.invitations where installation_id=$1 and token_hash=$2 and expires_at>now() for update`,[i.id,digest(v.invitationToken)]);
 if(!inv)return {ok:false};
 if(v.event==='shown')await c.query('update negotiation.invitations set shown_at=coalesce(shown_at,now()) where id=$1',[inv.id]);
 else await c.query('update negotiation.invitations set dismissed_at=coalesce(dismissed_at,now()) where id=$1',[inv.id]);
 await recordEvent(c,{workspaceId:i.workspace_id,eventKey:`invitation:${inv.id}:${v.event}`,type:v.event==='shown'?'invitation_shown':'invitation_dismissed',mode:inv.signals.tester?'sandbox':'live',visitorKey:inv.visitor_key,properties:{surface:inv.surface,policyVersion:inv.settings_version}});
 return {ok:true};});}
export async function readInvitation(c,installation,product,settings,input){
 if(typeof input.invitationToken!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(input.invitationToken))throw Error('NEGOTIATION_UNAVAILABLE');
 const {rows:[inv]}=await c.query(`select * from negotiation.invitations where installation_id=$1 and product_id=$2 and token_hash=$3 and visitor_key=$4 and settings_version=$5 and surface=$6 and expires_at>now() and consumed_at is null and dismissed_at is null for update`,[installation.id,product.id,digest(input.invitationToken),digest(installation.workspace_id+':'+input.visitorId),settings.version,input.surface]);
 if(!inv)throw Error('NEGOTIATION_UNAVAILABLE');
 return inv;
}
