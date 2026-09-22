import { randomUUID } from 'node:crypto';
import { decide } from './rules.js';
import { parseTarget, renderDecision } from './ai.js';
import { eon } from './merchant.js';
export function createDemo({ merchant = eon } = {}) {
 const sessions = new Map();
 return function handle(body) {
  const now = Date.now();
  for (const [id, s] of sessions) if (s.expiresAt <= now) sessions.delete(id);
  if (body.action === 'start') {
   if (sessions.size >= 1000) throw new Error('DEMO_CAPACITY');
   const id = randomUUID();
   sessions.set(id, { round: 0, expiresAt: now + 15 * 60 * 1000, done: false });
   return { id, demo: true, expiresAt: sessions.get(id).expiresAt };
  }
  const session = sessions.get(body.id);
  if (!session || session.done) throw new Error('SESSION_UNAVAILABLE');
  const target = parseTarget(body.target);
  const result = decide({ target, round: session.round + 1, price: merchant.product.price, ...merchant.policy, expiresAt: session.expiresAt, now });
  session.round++;
  session.done = result.status === 'accepted' || session.round >= 3;
  return { ...result, message: renderDecision(result), demo: true, round: session.round, done: session.done };
 };
}
