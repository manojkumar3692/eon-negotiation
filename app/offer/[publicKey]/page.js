import OfferChat from '../../../components/OfferChat.js';
export default async function OfferPage({params,searchParams}){
 const {publicKey}=await params,q=await searchParams;
 return <OfferChat publicKey={publicKey} productId={q.productId||''} variantId={q.variantId||''} currency={(q.currency||'').toUpperCase()} surface={q.surface||'dedicated_page'} visitorId={q.visitorId} signals={{visits:Number(q.visits)||0,dwellSeconds:Number(q.dwellSeconds)||0,inCart:q.surface==='cart',checkoutHesitation:q.surface==='exit_intent'}}/>;
}
