// Port for a future LLM intent extractor. It receives public product context only.
// This scaffold uses explicit numeric input; no paid model is connected.
export function parseTarget(text) {
  const match = String(text).trim().match(/^(?:₹\s*)?(\d{1,6})(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error('Enter one price, such as 900 or 900.50');
  const amount = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  if (amount <= 0) throw new Error('Price must be positive');
  return amount;
}
export function renderDecision(result) {
  if (!result.amount) return 'This negotiation is unavailable. You can still shop at the listed price.';
  const price = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(result.amount / 100);
  return `${result.status === 'accepted' ? 'Your price works' : 'We can offer'}: ${price}. Item price only; delivery and taxes are confirmed at checkout.${result.final ? ' This is the final round.' : ''}`;
}
