import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seal,unseal,assertEndpoint,fetchContext,cartFingerprint} from '../lib/connectors/client-v2.js';
const env={NODE_ENV:'development',NEON_BRANCH:'dashboard-onboarding',CONNECTOR_LOCAL_ENABLED:'true',CONNECTOR_ENCRYPTION_KEY:'a'.repeat(64)};
const binding='tenant:install',token='x'.repeat(43);
const installation={id:'install',workspace_id:'tenant',endpoint:'http://127.0.0.1:3001/api/negotiation/v2',credential_ciphertext:seal(token,binding,env)};
test('credentials encrypt and bind to exact tenant/install; wrong key/tampering fail',()=>{
  assert.equal(unseal(installation.credential_ciphertext,binding,env),token);
  assert.ok(!installation.credential_ciphertext.includes(token));
  assert.throws(()=>unseal(installation.credential_ciphertext,'other:install',env));
  assert.throws(()=>unseal(installation.credential_ciphertext,binding,{...env,CONNECTOR_ENCRYPTION_KEY:'b'.repeat(64)}));
});
test('outbound endpoint is exact, development-only, and cannot target arbitrary private/public hosts',()=>{
  assert.equal(assertEndpoint(installation.endpoint,env),installation.endpoint);
  for(const endpoint of ['http://localhost:3001/api/negotiation/v2','http://169.254.169.254/','https://example.com','http://127.0.0.1:3001/api/negotiation/v2?redirect=x','http://127.0.0.1:3002/api/negotiation/v2'])assert.throws(()=>assertEndpoint(endpoint,env));
  assert.throws(()=>assertEndpoint(installation.endpoint,{...env,NODE_ENV:'production'}));
  assert.throws(()=>assertEndpoint(installation.endpoint,{...env,NEON_BRANCH:'production'}));
});
test('client rejects errors, oversized/malformed/mismatched responses and forbids redirects',async()=>{
  for(const response of [new Response('{}',{status:401}),new Response('bad',{headers:{'Content-Type':'application/json'}}),new Response('x'.repeat(128001),{headers:{'Content-Type':'application/json'}}),Response.json({schemaVersion:'2'})]) {
    await assert.rejects(fetchContext(installation,{operation:'capabilities'},{env,fetcher:async(url,options)=>{assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,`Bearer ${token}`);assert.equal(JSON.parse(options.body).tenantId,'tenant');return response;}}));
  }
});
test('cart identity is order-independent but binds quantity, promotion, payment and destination',()=>{
 const cart={currency:'INR',lines:[{productId:'a',variantId:'a:50ml',quantity:1},{productId:'b',variantId:'b:50ml',quantity:1}],promotionCodes:[],paymentMethod:'prepaid',destination:null};
 assert.equal(cartFingerprint(cart),cartFingerprint({...cart,lines:[...cart.lines].reverse()}));
 for(const change of [{paymentMethod:'partial_cod'},{promotionCodes:['EON20']},{destination:{country:'IN',postalCode:'600001'}},{lines:[{...cart.lines[0],quantity:2}]}])assert.notEqual(cartFingerprint(cart),cartFingerprint({...cart,...change}));
});
