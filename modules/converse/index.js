// Deterministic offline fixture interpreter, not a replacement for the live LLM adapter.
// Production: lib/live/ai.js must emit this allowlisted intent; Rules revalidates everything.
export function interpretSandbox(message) {
  if (typeof message !== 'string' || message.length > 1000) return {intent:'clarify'};
  const text=message.toLowerCase();
  const amount=text.match(/(?:under|below|for|₹|rs\.?|inr)\s*(\d+(?:\.\d{1,2})?)/i);
  const numeric=/^\d+(?:\.\d{1,2})?$/.test(text.trim())?text.trim():null;
  const value=amount?.[1]||numeric;
  const targetMinor=value?Math.round(Number(value)*100):null;
  return {intent:'request',targetMinor:Number.isSafeInteger(targetMinor)?targetMinor:null,
    quantity:/\b(two|2)\b/.test(text)?2:1,
    preferredType:/shipping|delivery/.test(text)?'shipping':/sample/.test(text)?'sample':/\b(two|2)\b/.test(text)?'quantity':'price',
    needsConfirmation:true};
}
