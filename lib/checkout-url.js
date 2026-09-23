// Shared by the connector boundary and the shopper UI. The destination is
// returned by the authenticated merchant connector, never shopper message text.
export function safeCheckoutUrl(value){
 if(typeof value!=='string'||value.length>8192)throw Error('INVALID_CHECKOUT_URL');
 let url;try{url=new URL(value);}catch{throw Error('INVALID_CHECKOUT_URL');}
 if(url.protocol!=='https:'||!url.hostname||url.username||url.password)throw Error('INVALID_CHECKOUT_URL');
 return url.href;
}
