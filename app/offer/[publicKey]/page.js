import OfferChat from "../../../components/OfferChat.js";
export default async function OfferPage({params,searchParams}) {
  const {publicKey}=await params,q=await searchParams;
  return <OfferChat publicKey={publicKey} productId={q.productId||""} variantId={q.variantId||""} currency={(q.currency||"").toUpperCase()}/>;
}
