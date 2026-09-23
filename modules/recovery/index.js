import {randomBytes,createHash} from 'node:crypto';
const hash=token=>createHash('sha256').update(token).digest('hex');
// Call ONLY after verifying tenant ownership, recovery consent and cart ownership.
// The client must be inside the server transaction; it is never a browser SQL client.
export async function issueGrant(client,{workspaceId,cartHash,purpose='recovery',sessionId=null,quoteId=null,ttlSeconds=900}) {
 if (!workspaceId || !cartHash || !['recovery','checkout'].includes(purpose) ||
     !Number.isInteger(ttlSeconds) || ttlSeconds<60 || ttlSeconds>86400 ||
     (purpose==='checkout'&&(!sessionId||!quoteId))) throw Error('INVALID_GRANT');
 const token=randomBytes(32).toString('base64url');
 const {rows:[grant]}=await client.query(`insert into negotiation.offer_grants
 (workspace_id,purpose,token_hash,session_id,quote_id,cart_hash,expires_at)
 values($1,$2,$3,$4,$5,$6,now()+$7*interval '1 second') returning id,expires_at`,
 [workspaceId,purpose,hash(token),sessionId,quoteId,cartHash,ttlSeconds]);
 return {grantId:grant.id,token,expiresAt:grant.expires_at};
}
// Atomic one-use consumption. Checkout caller persists idempotency+reservation+outbox
// in this SAME transaction. A retry must resolve its existing attempt before consuming again.
export async function consumeGrant(client,{workspaceId,cartHash,purpose,token}) {
 if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))throw Error('GRANT_UNAVAILABLE');
 const {rows:[grant]}=await client.query(`update negotiation.offer_grants set consumed_at=now()
 where workspace_id=$1 and cart_hash=$2 and purpose=$3 and token_hash=$4
 and consumed_at is null and revoked_at is null and expires_at>now()
 returning id,session_id,quote_id`,[workspaceId,cartHash,purpose,hash(token)]);
 if(!grant)throw Error('GRANT_UNAVAILABLE');
 return grant;
}
