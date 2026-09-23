import {validateProductRuleAgainstCatalog} from './product-rule-validation.js';
import {seal} from '../connectors/client-v2.js';
import {importReady} from '../commerce/catalog-facts.js';
import {tenant} from '../db.js';
import {defaultConversion,conversionSchema,conversionTestSchema} from './config.js';
import {simulateConversion} from './engine.js';
import {suggestRuleChange} from '../../modules/optimize/index.js';
import {createHash,randomBytes} from 'node:crypto';
import {z} from 'zod';
async function owned(c,id){if(!z.string().uuid().safeParse(id).success)throw Error('NOT_FOUND');const {rows:[w]}=await c.query('select * from negotiation.workspaces where id=$1',[id]);if(!w)throw Error('NOT_FOUND');return w;}
async function audit(c,id,user,name,detail){await c.query('insert into negotiation.audit_events(workspace_id,actor_user_id,name,detail) values($1,$2,$3,$4)',[id,user,name,detail]);}
async function settings(c,id){const {rows:[s]}=await c.query('select * from negotiation.conversion_settings where workspace_id=$1',[id]);return s||{version:0,config:defaultConversion(),status:'draft'};}
export async function conversionState(user,id){return tenant(user,async c=>{
 const workspace=await owned(c,id),s=await settings(c,id);
 const {rows:tests}=await c.query('select id,settings_version,input,result,created_at from negotiation.conversion_tests where workspace_id=$1 order by created_at desc limit 20',[id]);
 const {rows:installations}=await c.query('select id,public_key,provider,status,activation_status,last_result from negotiation.connector_installations where workspace_id=$1 and revoked_at is null',[id]);
 const {rows:[funnel]}=await c.query(`select
 (select count(*)::int from negotiation.live_sessions where workspace_id=$1) as started,
 (select count(*)::int from negotiation.live_sessions where workspace_id=$1 and status='accepted') as accepted,
 (select count(*)::int from negotiation.checkout_attempts where workspace_id=$1 and status in ('created','paid','refunded')) as checkout,
 (select count(*)::int from negotiation.checkout_attempts where workspace_id=$1 and status='paid') as paid,
 (select count(*)::int from negotiation.checkout_attempts where workspace_id=$1 and status='refunded') as refunded,
 (select coalesce(sum(q.amount_minor+q.shipping_minor),0)::float8 from negotiation.checkout_attempts a join negotiation.live_quotes q on q.id=a.quote_id where a.workspace_id=$1 and a.status='paid') as paid_total_minor,
 (select coalesce(avg(q.baseline_minor-q.amount_minor),0)::float8 from negotiation.checkout_attempts a join negotiation.live_quotes q on q.id=a.quote_id where a.workspace_id=$1 and a.status='paid') as average_discount_minor,
 (select coalesce(sum(q.amount_minor+q.shipping_minor),0)::float8 from negotiation.checkout_attempts a join negotiation.live_quotes q on q.id=a.quote_id join negotiation.live_sessions s on s.id=a.session_id where a.workspace_id=$1 and a.status='paid' and s.recovery_grant_id is not null) as recovered_total_minor`,[id]);
 const {rows:events}=await c.query("select event_type,count(*)::int as count from negotiation.conversion_events where workspace_id=$1 and mode='live' group by event_type",[id]);
 const {rows:products}=await c.query(`select s.cart->'lines'->0->>'variantId' as variant,count(*)::int as orders,sum(q.amount_minor+q.shipping_minor)::float8 as total_minor from negotiation.checkout_attempts a join negotiation.live_quotes q on q.id=a.quote_id join negotiation.live_sessions s on s.id=a.session_id where a.workspace_id=$1 and a.status='paid' group by 1 order by total_minor desc limit 10`,[id]);
 const {rows:cohorts}=await c.query("select properties->>'reasonCode' as arm,count(*)::int as count from negotiation.conversion_events where workspace_id=$1 and mode='live' and event_type='experiment_assigned' group by 1",[id]);
 return {version:s.version,status:s.status,config:s.config,tests,installations,domainVerified:workspace.domain_verified,funnel,events,topProducts:products,
 optimization:suggestRuleChange({completedOrders:funnel.paid,minOrders:s.config.experiment.minOrders,controlVisitors:cohorts.find(r=>r.arm==='control')?.count||0,treatmentVisitors:cohorts.find(r=>r.arm==='treatment')?.count||0}),cohorts};
});}
export async function conversionAction(user,id,input){return tenant(user,async c=>{
 const workspace=await owned(c,id);await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[id]);
 const s=await settings(c,id);
 if(input.action==='tester_link'){
  const v=z.object({action:z.literal('tester_link'),productId:z.string().uuid(),url:z.string().url().max(2000)}).strict().parse(input);
  const url=new URL(v.url);if(url.protocol!=='https:'||url.username||url.password||url.port||url.hostname.replace(/^www\./,'')!==workspace.domain.replace(/^www\./,''))throw Error('Conversion: Enter a product-page URL on your verified store domain.');
  const {rows:[p]}=await c.query('select id from negotiation.products where workspace_id=$1 and id=$2',[id,v.productId]);if(!p)throw Error('NOT_FOUND');
  if(!s.version)throw Error('Conversion: Save your configuration first.');
  if(s.status!=='active')throw Error('Conversion: Activate your saved configuration before creating a private tester link.');
  if(s.config.audience!=='testers')throw Error('Conversion: Select Private testers only and complete launch checks before creating a tester link.');
  if(!s.config.products.some(rule=>rule.id===p.id&&rule.enabled))throw Error('Conversion: Select a product enabled in your saved negotiation rules.');
  const token=seal(JSON.stringify({productId:p.id,version:s.version,expiresAt:Date.now()+3600000}),`tester:${id}`);
  url.hash=new URLSearchParams({eonTest:token}).toString();
  await audit(c,id,user,'Private tester link created','One-hour product-scoped access. Checkout readiness and saved rules still apply.');
  return {url:url.toString()};
 }
 if(input.action==='save'){
  const config=conversionSchema.parse(input.config);if(input.expectedVersion!==s.version)throw Error('CONFLICT');
  for(const rule of config.products){const {rows:[p]}=await c.query('select name,price_minor from negotiation.products where workspace_id=$1 and id=$2',[id,rule.id]);validateProductRuleAgainstCatalog(rule,p);}
  const version=s.version+1;
  await c.query(`insert into negotiation.conversion_settings(workspace_id,version,config,updated_by) values($1,$2,$3,$4)
  on conflict(workspace_id) do update set version=$2,config=$3,status='draft',updated_by=$4,updated_at=now()`,[id,version,config,user]);
  await c.query('insert into negotiation.conversion_setting_history(workspace_id,version,config,actor) values($1,$2,$3,$4)',[id,version,config,user]);
  await audit(c,id,user,'Conversion configuration saved',`Version ${version}. Changes remain in draft until launch checks pass.`);return {version};
 }
 if(input.action==='test'){
  const v=conversionTestSchema.parse(input.input),{rows:[p]}=await c.query('select *, $3::text as currency from negotiation.products where workspace_id=$1 and id=$2',[id,v.productId,workspace.currency]);if(!p)throw Error('NOT_FOUND');
  const {rows:[policy]}=await c.query('select config from negotiation.policy_versions where workspace_id=$1 order by version desc limit 1',[id]);
  const result=simulateConversion(p,policy.config,s.config,v);
  await c.query('insert into negotiation.conversion_tests(workspace_id,settings_version,input,result) values($1,$2,$3,$4)',[id,s.version,v,result]);
  await audit(c,id,user,'Conversion test completed',`${p.name}: ${result.status}; configuration ${s.version}. No live order.`);return result;
 }
 if(input.action==='pause'){
  await c.query("update negotiation.conversion_settings set status='paused',updated_at=now() where workspace_id=$1",[id]);
  await c.query("update negotiation.connector_installations set activation_status='paused' where workspace_id=$1 and revoked_at is null",[id]);
  await c.query("update negotiation.live_quotes set status='expired' where workspace_id=$1 and status='offered'",[id]);
  await audit(c,id,user,'Merchant paused negotiation','Invitations and new offers paused; open quotes expired. Existing orders still reconcile.');return {status:'paused'};
 }
 if(input.action==='recovery_link'){
  const v=z.object({action:z.literal('recovery_link'),productId:z.string().uuid(),consentConfirmed:z.literal(true)}).strict().parse(input);
  if(!s.config.recovery.enabled||!s.config.surfaces.recovery_link)throw Error('Conversion: Enable recovery and its entry point, then save your settings.');
  const {rows:[product]}=await c.query('select * from negotiation.products where workspace_id=$1 and id=$2',[id,v.productId]);if(!product)throw Error('NOT_FOUND');
  if(!s.config.products.some(p=>p.id===product.id&&p.enabled))throw Error('Conversion: Enable the recovery product in your saved rules.');
  const {rows:[installation]}=await c.query("select public_key from negotiation.connector_installations where workspace_id=$1 and status='ready' and activation_status='active' and revoked_at is null limit 1",[id]);
  if(!installation||s.status!=='active')throw Error('Conversion: Recovery links unlock after exact checkout and negotiation activation are verified.');
  const token=randomBytes(32).toString('base64url'),digest=createHash('sha256').update(token).digest('hex');
  const binding=JSON.stringify({publicKey:installation.public_key,productId:product.external_product_id,variantId:product.external_variant_id,currency:workspace.currency});
  const {rows:[grant]}=await c.query('select * from negotiation.create_recovery_grant($1,$2,$3,$4)',[id,digest,binding,s.config.recovery.expiryHours*3600]);
  await audit(c,id,user,'Recovery link created',`One-use invite ${grant.id}; permission confirmed by merchant. No message was sent.`);
  return {url:`${process.env.APP_ORIGIN}/recover#${token}`,expiresAt:grant.expires_at};
 }
 if(input.action==='activate'){
  if(!s.version)throw Error('Conversion: Save your configuration first.');
  if(!workspace.domain_verified)throw Error('Conversion: Verify your store domain first.');
  const {rows:[ready]}=await c.query("select id from negotiation.connector_installations where workspace_id=$1 and status='ready' and activation_status='active' and revoked_at is null limit 1",[id]);
  if(!ready)throw Error('Conversion: Complete exact-cart economics, checkout and payment-event checks in EON Connect first.');
  if(process.env.NEGOTIATION_ENABLED!=='true')throw Error('Conversion: Production negotiation is disabled until a genuine paid-order acceptance test passes.');
  if(!s.config.products.some(p=>p.enabled&&p.costMinor!==null))throw Error('Conversion: Configure at least one product with an approved cost and minimum.');
  if(!s.config.concessions.price)throw Error('Conversion: Enable a checkout-supported concession before activation.');
  if(Object.entries(s.config.concessions).some(([k,v])=>k!=='price'&&v))throw Error('Conversion: Your current checkout adapter enforces price only. Disable extra concessions until their checkout capability is verified.');
  const {rows:[test]}=await c.query("select id from negotiation.conversion_tests where workspace_id=$1 and settings_version=$2 and result->>'status'='counteroffer' limit 1",[id,s.version]);if(!test)throw Error('Conversion: Complete a successful test with your current saved configuration.');
  for(const rule of s.config.products.filter(p=>p.enabled)){const {rows:[p]}=await c.query('select * from negotiation.products where workspace_id=$1 and id=$2',[id,rule.id]);validateProductRuleAgainstCatalog(rule,p);if(!importReady(p))throw Error('Conversion: Confirm selling prices, shipping and promotion information through a new store sync before activation.');}
  for(const rule of s.config.products.filter(p=>p.enabled))await c.query('update negotiation.products set floor_minor=$1 where workspace_id=$2 and id=$3',[rule.floorMinor,id,rule.id]);
  await c.query("update negotiation.conversion_settings set status='active',updated_at=now() where workspace_id=$1",[id]);
  await audit(c,id,user,'Conversion configuration activated',`Version ${s.version}; all live gates checked.`);return {status:'active'};
 }
 throw Error('NOT_FOUND');
});}
