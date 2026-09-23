import {service} from '../db.js';
import {createHash} from 'node:crypto';
export async function publicWidgetConfig(key,origin){return service(async c=>{
 const {rows:[row]}=await c.query(`select w.domain,i.activation_status,s.status,s.config from negotiation.connector_installations i
 join negotiation.workspaces w on w.id=i.workspace_id left join negotiation.conversion_settings s on s.workspace_id=i.workspace_id
 where i.public_key=$1 and i.revoked_at is null`,[key]);
 if(!row)return {enabled:false};
 let host;try{host=new URL(origin).hostname.replace(/^www\./,'')}catch{return {enabled:false}};
 if(host!==row.domain.replace(/^www\./,''))return {enabled:false};
 const enabled=process.env.NEGOTIATION_ENABLED==='true'&&row.activation_status==='active'&&row.status==='active';
 return {enabled,surfaces:enabled?row.config.surfaces:{},triggers:enabled?{minVisits:row.config.triggers.minVisits,minDwellSeconds:row.config.triggers.minDwellSeconds,cooldownHours:row.config.triggers.cooldownHours}:{}};
});}
export async function recoveryInfo(token){
 if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))throw Error('QUOTE_EXPIRED');
 return service(async c=>{const {rows:[grant]}=await c.query(`select g.cart_hash from negotiation.offer_grants g join negotiation.conversion_settings s on s.workspace_id=g.workspace_id
 where g.token_hash=$1 and g.purpose='recovery' and g.consumed_at is null and g.revoked_at is null and g.expires_at>now() and s.status='active'`,[createHash('sha256').update(token).digest('hex')]);
 if(!grant)throw Error('QUOTE_EXPIRED');return JSON.parse(grant.cart_hash);});
}
