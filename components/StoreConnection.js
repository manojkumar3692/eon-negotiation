"use client";
import { useEffect, useState } from 'react';

const sourceLabel = {live:'Live',merchant_configured:'Store configuration',derived:'Calculated by store',stale:'Expired',unavailable:'Missing'};
export default function StoreConnection({workspace}) {
  const [connection,setConnection]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[now,setNow]=useState(Date.now());
  const [variant,setVariant]=useState(''),[quantity,setQuantity]=useState('1'),[payment,setPayment]=useState('prepaid'),[promotion,setPromotion]=useState(''),[country,setCountry]=useState('IN'),[postal,setPostal]=useState(''),[changed,setChanged]=useState(true);
  async function api(body) {
    const response=await fetch(`/api/platform/workspaces/${workspace.id}/installation`,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'});
    const value=await response.json();if(!response.ok)throw Error(value.error||'Could not load connection.');return value;
  }
  useEffect(()=>{let active=true;api().then(v=>{if(active)setConnection(v);}).catch(e=>{if(active)setError(e.message);});const timer=setInterval(()=>setNow(Date.now()),1000);return()=>{active=false;clearInterval(timer);};},[workspace.id]);
  const result=connection?.result, facts=result?.facts, catalog=facts?.catalog?.value||[];
  const selected=catalog.find(p=>p.variantId===variant)||catalog[0];
  const expired=!!result && Date.parse(result.expiresAt)<=now;
  const usable=!!result && !expired && !changed && connection.status==='read_only';
  const money=n=>new Intl.NumberFormat('en',{style:'currency',currency:workspace.currency}).format(n/100);
  async function run(body) {
    setBusy(true);setError('');
    try {
      let value=await api(body);
      if(body.action==='connect')value=await api({action:'test'});
      setConnection(value);setNow(Date.now());
      if(body.action==='test'||body.action==='connect')setChanged(false);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  function changedInput(setter){return e=>{setter(e.target.value);setChanged(true);};}
  return <section className="panel" style={{padding:28,marginBottom:24}} aria-label="Store connection">
    <div className="section-head"><div><span className="eyebrow">YOUR STORE, CONNECTED</span><h2>{workspace.name} · store connection</h2><p>Read the store’s catalog and check an actual cart before you enable negotiation.</p></div><span className="pill amber">Read-only testing</span></div>
    {error&&<p className="notice error" role="alert">{error}</p>}
    {!connection&&!error&&<p role="status">Loading connection…</p>}
    {connection&&!connection.configured&&<>
      <ol><li>Connect your store’s approved data source.</li><li>Choose a product and check its current cart price.</li><li>Review missing data before activation.</li></ol>
      <p>{connection.localAvailable?'Your local store connection is ready. Its dedicated credential stays on the server.':'Ask your store administrator to provision a read-only connection for this workspace.'}</p>
      <button className="primary" disabled={busy||!connection.localAvailable} onClick={()=>run({action:'connect'})}>{busy?'Connecting to your store…':'Connect local store'}</button>
    </>}
    {connection?.configured&&<>
      <div className="notice" role="status"><div><strong>{busy?'Checking store…':connection.status==='failed'?'Connection needs attention':connection.status==='not_tested'?'Connected · not checked':expired?'Connected · refresh required':'Connected · read-only'}</strong><p>{connection.error||'Requests go to your merchant server. No order or payment is created.'}</p>
      {connection.lastSuccessAt&&<small>Last successful check: {new Date(connection.lastSuccessAt).toLocaleString()}{result&&` · ${expired?'Result expired':'Result expires at '+new Date(result.expiresAt).toLocaleTimeString()}`}</small>}</div></div>
      <button className="secondary" disabled={busy} onClick={()=>run({action:'test'})}>{busy?'Checking…':'Refresh store connection'}</button>
      {catalog.length>0&&<>
        <h3 style={{marginTop:24}}>1. Check a cart from your store</h3><p>{catalog.length} products returned by your store. Base prices are shown below; your cart check includes selected promotions and quantity pricing.</p>
        <form onSubmit={e=>{e.preventDefault();run({action:'test',cart:{currency:workspace.currency,lines:[{productId:selected.productId,variantId:selected.variantId,quantity:Number(quantity)}],promotionCodes:promotion.trim()?[promotion.trim().toUpperCase()]:[],paymentMethod:payment,destination:postal.trim()?{country:country.toUpperCase(),postalCode:postal.trim()}:null}});}}>
          <div className="form-grid">
            <label>Store product<select value={selected?.variantId||''} onChange={changedInput(setVariant)}>{catalog.map(p=><option key={p.variantId} value={p.variantId}>{p.name} · {p.size} · {money(p.basePriceMinor)}</option>)}</select></label>
            <label>Quantity<input type="number" min="1" max="20" required value={quantity} onChange={changedInput(setQuantity)}/></label>
            <label>Payment method<select value={payment} onChange={changedInput(setPayment)}><option value="prepaid">Pay in full</option><option value="partial_cod">Token now + cash on delivery</option></select></label>
            <label>Promotion code (optional)<input maxLength={200} value={promotion} onChange={changedInput(setPromotion)} placeholder="Enter a store promotion"/></label>
            <label>Destination country<input minLength={2} maxLength={2} required value={country} onChange={changedInput(setCountry)}/></label>
            <label>Postal code (optional)<input maxLength={16} value={postal} onChange={changedInput(setPostal)} placeholder="For shipping context"/></label>
          </div><button className="primary" disabled={busy} type="submit">{busy?'Checking your cart…':'Check store price'}</button>
        </form>
      </>}
      {result?.operation==='context'&&facts?.sellingPrice?.value&&<div style={{marginTop:24,padding:24,background:'var(--surface, #f4f5ef)',borderRadius:16}} aria-label="Store price result">
        <span className={'pill '+(usable?'green':'amber')}>{usable?'Verified store response':changed?'Cart changed · check again':'Expired result · check again'}</span>
        <h3>Store cart total: {money(facts.sellingPrice.value.totalMinor)}</h3>
        <p>Before promotion: {money(facts.sellingPrice.value.subtotalMinor)} · Discount: {money(facts.sellingPrice.value.discountMinor)}</p>
        {facts.payment.value&&<p>Pay now: {money(facts.payment.value.chargeNowMinor)} · Due on delivery: {money(facts.payment.value.balanceDueMinor)}</p>}
        <p>Applied promotions: {facts.promotions.value?.applied.join(', ')||'None'}</p>
        <small>This is the current store price for this test cart. It is not a negotiated offer. Delivery eligibility and freight cost remain unverified.</small>
      </div>}
      {facts&&<>
        <h3 style={{marginTop:24}}>2. Review data readiness</h3>
        <div className="table-wrap"><table><thead><tr><th>Required data</th><th>Source / status</th><th>What happens next</th></tr></thead><tbody>
          {[['catalog','Products'],['sellingPrice','Cart price'],['taxBasis','Tax basis'],['inventory','Available stock'],['economics','Approved price floors'],['shipping','Shipping'],['sales','Comparable sales'],['payment','Payment constraints']].map(([key,label])=>{const f=facts[key];return <tr key={key}><td>{label}</td><td>{expired&&f.status!=='unavailable'?'Expired':sourceLabel[f.status]}</td><td>{f.requirement||f.source}</td></tr>;})}
        </tbody></table></div>
        <h3 style={{marginTop:24}}>3. Choose your shipping approach</h3>
        <label>Shipping mode<select disabled={busy} value={connection.shippingMode} onChange={e=>run({action:'shipping',mode:e.target.value})}><option value="unconfigured">Choose an approach</option><option value="flat">Merchant-approved flat rate</option><option value="zone_table">Country / zone rate table</option><option value="live_quote">Live quote from store</option></select></label>
        <p className="fine">This saves your setup preference only. Rate amounts, coverage and serviceability still need approval; choosing a mode does not supply a shipping cost.</p>
        <div className="notice"><div><strong>Activation is blocked</strong><ul>{result.requirements.map(r=><li key={r}>{r}</li>)}</ul><button className="secondary" disabled>Activate negotiation</button></div></div>
      </>}
    </>}
  </section>;
}
