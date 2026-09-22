"use client";
import {useState} from "react";

const money=(minor,currency)=>new Intl.NumberFormat("en",{style:"currency",currency}).format(minor/100);
export default function OfferChat({publicKey,productId,variantId,currency}) {
  const [session,setSession]=useState(null),[messages,setMessages]=useState([]),[text,setText]=useState(""),[postal,setPostal]=useState(""),[country,setCountry]=useState("IN"),[busy,setBusy]=useState(false),[error,setError]=useState(""),[confirm,setConfirm]=useState(false),[quote,setQuote]=useState(null);
  async function request(path,body,token=session?.sessionToken) {
    setBusy(true);setError("");
    try {const response=await fetch(`/api/negotiate/${path}`,{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)}),value=await response.json();if(!response.ok)throw Error(value.error||"Request failed");return value;}
    finally{setBusy(false);}
  }
  async function start() {try {const value=await request("start",{publicKey,cart:{currency,lines:[{productId,variantId,quantity:1}],promotionCodes:[],paymentMethod:"prepaid",destination:postal?{country:country.toUpperCase(),postalCode:postal}:null}},null);setSession(value);setMessages([{role:"assistant",content:value.message}]);}catch(e){setError(e.message);}}
  async function send(e){e.preventDefault();const value=text.trim();if(!value)return;setText("");setMessages(m=>[...m,{role:"customer",content:value}]);try{const result=await request(`${session.sessionId}/message`,{message:value});setMessages(m=>[...m,{role:"assistant",content:result.message}]);setConfirm(Boolean(result.confirmTarget));}catch(e){setError(e.message);}}
  async function confirmOffer(){try{const result=await request(`${session.sessionId}/confirm`,{});setMessages(m=>[...m,{role:"assistant",content:result.message}]);setConfirm(false);setQuote(result.quote||null);}catch(e){setError(e.message);}}
  async function accept(){try{const result=await request(`${session.sessionId}/accept`,{quoteId:quote.id,idempotencyKey:crypto.randomUUID()});window.location.assign(result.checkoutUrl);}catch(e){setError(e.message);}}
  if(!productId||!variantId||!currency)return <main className="offer-shell"><section className="offer-card"><h1>This offer link is incomplete</h1><p>Return to the store and open negotiation from a product page.</p></section></main>;
  return <main className="offer-shell"><section className="offer-card">
    <div className="brand">negotiation<span className="brand-dot">.</span></div>
    {!session?<><span className="eyebrow">CUSTOMER OFFER</span><h1>Ask for a better price.</h1><p>The store’s current inventory, approved limits and checkout are checked before any offer is shown.</p><div className="form-grid"><label>Country<input value={country} maxLength={2} onChange={e=>setCountry(e.target.value)}/></label><label>Postal code{/** Physical stores can require this; custom adapters decide. */}<input value={postal} maxLength={24} onChange={e=>setPostal(e.target.value)} placeholder="Required for delivery offers"/></label></div><button className="primary" disabled={busy} onClick={start}>{busy?"Checking store…":"Start negotiation"}</button></>:<>
      <div className="offer-product"><span>{session.product.name}</span><strong>{money(session.product.unitPriceMinor,session.product.currency)}</strong></div>
      <div className="offer-messages">{messages.map((m,i)=><div key={i} className={`offer-message ${m.role}`}>{m.content}</div>)}</div>
      {quote&&<div className="offer-quote"><span>{quote.status}</span><h2>{money(quote.amountMinor,quote.currency)}</h2>{quote.shippingMinor>0&&<p>Shipping: {money(quote.shippingMinor,quote.currency)}</p>}<small>Valid until {new Date(quote.expiresAt).toLocaleTimeString()}</small><button className="primary" disabled={busy} onClick={accept}>Accept and checkout</button></div>}
      {confirm?<button className="primary" disabled={busy} onClick={confirmOffer}>{busy?"Checking rules…":"Confirm my price"}</button>:<form className="offer-compose" onSubmit={send}><input aria-label="Message" value={text} onChange={e=>setText(e.target.value)} placeholder="Enter a price or ask a question"/><button className="primary" disabled={busy}>Send</button></form>}
    </>}
    {error&&<p className="notice" role="alert">{error}</p>}
    <p className="fine">AI helps understand the conversation. The merchant’s server rules authorize every price.</p>
  </section></main>;
}
