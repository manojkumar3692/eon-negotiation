import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { cartSchema, validateResponse } from './contract-v2.js';

export function cartFingerprint(input) {
  const cart = cartSchema.parse(input);
  return createHash('sha256').update(JSON.stringify({
    currency: cart.currency,
    lines: cart.lines.map(l => ({productId:l.productId,variantId:l.variantId,quantity:l.quantity})).sort((a,b) => a.variantId < b.variantId ? -1 : a.variantId > b.variantId ? 1 : 0),
    promotionCodes:[...cart.promotionCodes].sort(),paymentMethod:cart.paymentMethod,
    destination:cart.destination ? {country:cart.destination.country,postalCode:cart.destination.postalCode} : null,
  })).digest('hex');
}
function key(env) {
  if (!/^[a-f0-9]{64}$/.test(env.CONNECTOR_ENCRYPTION_KEY || '')) throw Error('Connector secret storage is not configured.');
  return Buffer.from(env.CONNECTOR_ENCRYPTION_KEY,'hex');
}
export function seal(token, binding, env = process.env) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm',key(env),iv);
  cipher.setAAD(Buffer.from(binding));
  const encrypted = Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
  return [iv,cipher.getAuthTag(),encrypted].map(b=>b.toString('base64url')).join('.');
}
export function unseal(value, binding, env = process.env) {
  const [iv,tag,encrypted] = value.split('.').map(s=>Buffer.from(s,'base64url'));
  const cipher = createDecipheriv('aes-256-gcm',key(env),iv);
  cipher.setAAD(Buffer.from(binding)); cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(encrypted),cipher.final()]).toString('utf8');
}
// This local pilot intentionally has no arbitrary outbound URL support.
// Exact IP/path/port allowlisting avoids DNS rebinding and redirects entirely.
export function assertEndpoint(endpoint, env = process.env) {
  if (env.NODE_ENV === 'production' || env.NEON_BRANCH !== 'dashboard-onboarding' || env.CONNECTOR_LOCAL_ENABLED !== 'true' || endpoint !== 'http://127.0.0.1:3001/api/negotiation/v2') throw Error('This endpoint is not approved for local connection testing.');
  return endpoint;
}
export async function fetchContext(installation, payload, {env=process.env, fetcher=fetch, now=Date.now} = {}) {
  assertEndpoint(installation.endpoint,env);
  const token = unseal(installation.credential_ciphertext,`${installation.workspace_id}:${installation.id}`,env);
  let response;
  try {
    response = await fetcher(installation.endpoint, {method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({schemaVersion:'2',tenantId:installation.workspace_id,installationId:installation.id,...payload})});
  } catch { throw Error('The store could not be reached. Check that the local store is running and retry.'); }
  if (!response.ok) {
    const messages = {401:'The store rejected its connection credential.',403:'The store rejected this workspace or installation.',422:'This cart or promotion is not supported by the store.',503:'The store connector is disabled or unavailable.'};
    throw Error(messages[response.status] || 'The store returned an unsuccessful response.');
  }
  if (!response.headers.get('content-type')?.includes('application/json')) throw Error('The store returned an invalid response.');
  const reader=response.body?.getReader(); if (!reader) throw Error('The store returned an empty response.');
  const chunks=[];let size=0;
  while(true) {const {done,value}=await reader.read(); if(done)break; size+=value.byteLength; if(size>128000){await reader.cancel();throw Error('The store response exceeded the size limit.');} chunks.push(value);}
  try {
    return validateResponse(JSON.parse(Buffer.concat(chunks).toString('utf8')), {tenantId:installation.workspace_id,installationId:installation.id,operation:payload.operation,fingerprint:payload.cart ? cartFingerprint(payload.cart):undefined},now());
  } catch {throw Error('The store response failed freshness, identity or contract checks.');}
}
