import { createInterpreter } from './openai.js';
import { parseTarget } from './ai.js';
import { createDemo } from './demo.js';
import { eon } from './merchant.js';
export function createChat({ interpret = createInterpreter(), merchant = eon } = {}) {
 const priceDemo = createDemo({ merchant });
 const chats = new Map();
 return async function chat(body) {
  if (!body || typeof body !== 'object') throw new Error('INVALID_INPUT');
  for(const [id,s] of chats) if (s.expiresAt <= Date.now() && !s.busy) chats.delete(id);
  if (body.action === 'start') {
   const session = priceDemo(body);
   chats.set(session.id, { history: [], pending: null, busy: false, expiresAt: session.expiresAt, count: 0 });
   return session;
  }
  const s = chats.get(body.id);
  if (!s || s.expiresAt <= Date.now()) throw new Error('SESSION_UNAVAILABLE');
  if (s.busy) throw new Error('MESSAGE_IN_PROGRESS');
  if (s.count >= 20) throw new Error('MESSAGE_LIMIT');
  s.busy = true;
  try {
   s.count++;
   if (body.action === 'confirm') {
    if (s.pending === null) throw new Error('NO_PENDING_PRICE');
    const target = s.pending; s.pending = null;
    const result = priceDemo({ id: body.id, target: (target / 100).toFixed(2) });
    s.history.push({ role: 'assistant', content: result.message });
    return result;
   }
   const message = body.message;
   if (typeof message !== 'string' || !message.trim() || message.length > 1000) throw new Error('INVALID_MESSAGE');
   s.pending = null;
   // Explicit numeric input remains available even when the provider is offline.
   try {
    parseTarget(message);
    const result = priceDemo({ id: body.id, target: message });
    s.history.push({ role: 'user', content: message }, { role: 'assistant', content: result.message });
    return { ...result, mode: 'numeric' };
   } catch (error) {
    if (error.message === 'SESSION_UNAVAILABLE') throw error;
   }
   let intent;
   try { intent = await interpret({ message, history: s.history.slice(-6), product: merchant.product }); }
   catch {
    return { message: 'The AI assistant is unavailable. You can still enter a price directly, for example 900.', mode: 'fallback', demo: true };
   }
   if (Date.now() >= s.expiresAt) throw new Error('SESSION_UNAVAILABLE');
   let reply;
   if (intent.currency === 'other') reply = 'This store currently negotiates in INR. What rupee price would you like to offer?';
   else if (intent.confidence < .85 || intent.intent === 'clarify') reply = 'What single item price in rupees would you like to offer? Shipping and checkout conditions are separate.';
   else if (intent.intent === 'offer' && Number.isSafeInteger(intent.targetPaise) && intent.targetPaise > 0 && intent.targetPaise <= 99999999) {
    s.pending = intent.targetPaise;
    reply = `You would like to offer ₹${(intent.targetPaise / 100).toFixed(2)} for one item. Confirm this price so I can check the merchant’s offer.`;
   } else if (intent.intent === 'greeting') reply = `Hi! I can help you make an offer for ${merchant.product.title}. What price did you have in mind?`;
   else if (intent.intent === 'product_question' && intent.topic === 'scent') reply = `${merchant.product.title} has a ${merchant.product.scent.toLowerCase()} scent. What price would you like to offer?`;
   else if (intent.intent === 'product_question' && intent.topic === 'size') reply = `This offer is for one ${merchant.product.size} bottle.`;
   else if (intent.intent === 'product_question' && intent.topic === 'shipping') reply = 'Shipping and taxes are confirmed at the store checkout. I cannot promise free delivery.';
   else if (intent.intent === 'accept') reply = 'This is a demo with no checkout. You can enter the displayed counteroffer as your price to test agreement while rounds remain.';
   else reply = 'I can help with an item price offer or basic product details. What price would you like to offer?';
   s.history.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
   s.history = s.history.slice(-6);
   return { message: reply, confirmPrice: s.pending !== null, mode: 'ai', demo: true };
  } finally { s.busy = false; }
 };
}
