// Server-only. All prices are integer paise. Never send policy to a shopper.
export function decide({ target, round, price, floor, maxDiscountBps, enabled, stock, expiresAt, now = Date.now() }) {
  const ints = [target, round, price, floor, maxDiscountBps, stock, expiresAt, now];
  if (!ints.every(Number.isSafeInteger) || target <= 0 || price <= 0 || floor <= 0 ||
      floor > price || maxDiscountBps < 0 || maxDiscountBps > 10000 || stock < 0 || round < 1) {
    throw new Error('INVALID_INPUT');
  }
  if (!enabled) return { status: 'unavailable', reason: 'disabled' };
  if (now >= expiresAt) return { status: 'unavailable', reason: 'expired' };
  if (stock === 0) return { status: 'unavailable', reason: 'out_of_stock' };
  if (round > 3) return { status: 'unavailable', reason: 'round_limit' };
  // BigInt avoids overflow in money multiplication; round the lower bound UP.
  const discountFloor = Number((BigInt(price) * BigInt(10000 - maxDiscountBps) + 9999n) / 10000n);
  const lowerBound = Math.max(floor, discountFloor);
  const steps = [0, 400, 700, 1000]; // fixed, transparent concession schedule in basis points
  const scheduled = Number((BigInt(price) * BigInt(10000 - steps[round]) + 9999n) / 10000n);
  const threshold = Math.max(lowerBound, scheduled);
  const amount = target >= threshold ? Math.min(target, price) : threshold;
  return { status: target >= threshold ? 'accepted' : 'counteroffer', amount, currency: 'INR', final: round === 3 };
}
