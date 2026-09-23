import {createHash,createHmac,randomUUID,timingSafeEqual} from "node:crypto";
import {lookup} from "node:dns/promises";
import {isIP} from "node:net";
import {cartSchema,connectorRequestSchema,validateConnectorResponse} from "./contract.js";
import {unseal} from "../connectors/client-v2.js";

export const fingerprint=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

function privateAddress(address) {
  if(isIP(address)===4) {
    const [a,b]=address.split(".").map(Number);
    return a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0))||(a===198&&(b===18||b===19||b===51))||(a===203&&b===0)||(a===100&&b>=64&&b<=127);
  }
  const value=address.toLowerCase();
  return value==="::"||value==="::1"||value.startsWith("fc")||value.startsWith("fd")||/^fe[89ab]/.test(value)||value.startsWith("2001:db8:")||value.startsWith("::ffff:127.")||value.startsWith("::ffff:10.")||value.startsWith("::ffff:192.168.");
}

export async function validateCustomEndpoint(endpoint,workspaceDomain,{env=process.env,resolver=lookup}={}) {
  const url=new URL(endpoint);
  if(url.protocol==="http:" && env.NODE_ENV!=="production" && url.href==="http://127.0.0.1:3001/api/negotiation/v3") return url.href;
  if(url.protocol!=="https:"||url.username||url.password||url.port||url.search||url.hash||!url.pathname.startsWith("/")) throw Error("Use an HTTPS connector endpoint without credentials, query parameters or fragments.");
  const host=url.hostname.toLowerCase(), domain=String(workspaceDomain).toLowerCase();
  if(host!==domain&&!host.endsWith(`.${domain}`)) throw Error("The connector endpoint must use the company domain or one of its subdomains.");
  const answers=await resolver(host,{all:true,verbatim:true});
  if(!answers.length||answers.some(x=>privateAddress(x.address))) throw Error("The connector endpoint must resolve only to public addresses.");
  return url.href;
}

export function verifyConnectorSignature(secret,{timestamp,nonce,body,signature,now=Date.now()}) {
  if(!/^\d{13}$/.test(timestamp||"")||Math.abs(now-Number(timestamp))>30000||!nonce||!signature) return false;
  const expected=createHmac("sha256",secret).update(`${timestamp}\n${nonce}\n${body}`).digest("hex");
  const a=Buffer.from(expected,"hex"),b=Buffer.from(signature,"hex");
  return a.length===b.length&&timingSafeEqual(a,b);
}

async function readJson(response) {
  if(!response.headers.get("content-type")?.includes("application/json")) throw Error("CONNECTOR_INVALID_CONTENT_TYPE");
  const reader=response.body?.getReader(); if(!reader)throw Error("CONNECTOR_EMPTY_RESPONSE");
  const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>256000){await reader.cancel();throw Error("CONNECTOR_RESPONSE_TOO_LARGE");}chunks.push(value);}
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function callCustomConnector(installation,operation,input={},options={}) {
  const env=options.env||process.env, fetcher=options.fetcher||fetch, clock=options.now||Date.now, requestTime=clock();
  // DNS and ownership are checked again immediately before each outbound call.
  // Redirects remain disabled, so a connector cannot move the request elsewhere.
  const endpoint=await validateCustomEndpoint(installation.endpoint,installation.workspace_domain||installation.domain,{env,resolver:options.resolver||lookup});
  const token=unseal(installation.credential_ciphertext,`${installation.workspace_id}:${installation.id}`,env);
  const request=connectorRequestSchema.parse({schemaVersion:"3",workspaceId:installation.workspace_id,installationId:installation.id,operation,...input});
  const body=JSON.stringify(request),timestamp=String(requestTime),nonce=randomUUID();
  const signature=createHmac("sha256",token).update(`${timestamp}\n${nonce}\n${body}`).digest("hex");
  let response;
  try {response=await fetcher(endpoint,{method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(10000),headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`,"X-Negotiation-Timestamp":timestamp,"X-Negotiation-Nonce":nonce,"X-Negotiation-Signature":signature},body});}
  catch{throw Error("CONNECTOR_UNREACHABLE");}
  if(!response.ok)throw Error({401:"CONNECTOR_UNAUTHORIZED",403:"CONNECTOR_FORBIDDEN",409:"CONNECTOR_CONFLICT",422:"CONNECTOR_UNSUPPORTED",503:"CONNECTOR_UNAVAILABLE"}[response.status]||"CONNECTOR_REQUEST_FAILED");
  const expected={operation,workspaceId:installation.workspace_id,installationId:installation.id};
  if(operation==="context")expected.cartFingerprint=fingerprint(cartSchema.parse(input.cart));
  // Validate against the time after the network response arrives. Comparing a
  // merchant's asOf timestamp with the pre-request clock makes every normal
  // response look future-dated by its network latency.
  return validateConnectorResponse(await readJson(response),expected,clock());
}
