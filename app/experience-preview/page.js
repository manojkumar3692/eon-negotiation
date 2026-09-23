"use client";
import CustomerPreview from '../../components/CustomerPreview.js';
import ImportedTerms from '../../components/ImportedTerms.js';
import {defaultConversion} from '../../lib/conversion/config.js';
const product={name:'Example product',priceMinor:99900,commerceFacts:{status:'confirmed',pricing:{regularMinor:124900,sellingMinor:99900,taxBasis:'inclusive',source:'Illustrative preview data — not a store sync'},storeTerms:{shipping:{mode:'free',customerChargeMinor:0},promotions:{status:'known',offers:[{code:'WELCOME20',description:'Example coupon; eligibility checked against the actual cart',combinesWithNegotiation:'no',expiresAt:null}]}}}};
export default function Page(){
 const config=defaultConversion();config.triggers.minVisits=2;config.triggers.minDwellSeconds=45;
 return <main className="conversion-studio" style={{maxWidth:1100,margin:'40px auto',padding:20}}>
  <CustomerPreview storeName="Example store" product={product} currency="INR" config={config}/>
  <section className="panel"><span className="eyebrow">MERCHANT VIEW · SAMPLE DATA</span><h2>How imported information will look</h2><p>This is an example of a complete import. Your dashboard will use your store’s actual response and mark any missing information.</p><ImportedTerms product={product} currency="INR"/></section>
 </main>;
}
