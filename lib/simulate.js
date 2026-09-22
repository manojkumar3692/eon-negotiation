// Merchant-only simulator. No order, payment, stock or subsidy side effects.
export function simulate(product, policy, input) {
  const reasons = [];
  if (input.round > policy.rounds)
    return {
      status: "unavailable",
      reason: "Round limit reached",
      reasons: [],
      simulated: true,
    };
  if (input.stock === 0)
    return {
      status: "unavailable",
      reason: "No available stock in this scenario",
      reasons: [],
      simulated: true,
    };
  if (input.stock === null)
    return {
      status: "unavailable",
      reason:
        "Availability is unknown. Provide a scenario value before testing stock-based rules.",
      reasons: [],
      simulated: true,
    };
  let cap = policy.maxDiscountBps;
  if (input.stock <= policy.lowStockThreshold) {
    cap = Math.min(cap, policy.lowStockDiscountBps);
    reasons.push("Low-stock limit reduces the permitted discount.");
  }
  const pace = input.stock >= policy.excessStockThreshold ? 1 : 0.65;
  reasons.push(
    input.stock >= policy.excessStockThreshold
      ? "Excess-stock scenario allows the full concession pace."
      : "Standard inventory uses a measured concession pace.",
  );
  const floorWithShipping = product.floorMinor + input.shippingReserveMinor;
  const capFloor = Math.ceil((product.priceMinor * (10000 - cap)) / 10000);
  let historyFloor = 0;
  if (
    policy.historyEnabled &&
    input.sampleCount >= 5 &&
    input.medianMinor > 0
  ) {
    historyFloor = Math.ceil(input.medianMinor * 0.95);
    reasons.push(
      "Qualified comparable history limits undercutting to 5% below the entered median.",
    );
  } else if (policy.historyEnabled)
    reasons.push(
      "History ignored: enter a comparable median and at least five sales.",
    );
  const floor = Math.max(floorWithShipping, capFloor, historyFloor);
  if (floor > product.priceMinor)
    return {
      status: "unavailable",
      reason:
        "The minimum price plus shipping reserve cannot fit within the selling price.",
      reasons,
      simulated: true,
    };
  const step = Math.floor((cap * pace * input.round) / policy.rounds);
  const suggested = Math.max(
    floor,
    Math.ceil((product.priceMinor * (10000 - step)) / 10000),
  );
  const amountMinor = Math.max(
    suggested,
    Math.min(input.targetMinor, product.priceMinor),
  );
  const discountMinor = product.priceMinor - amountMinor;
  if (discountMinor > policy.dailyBudgetMinor)
    return {
      status: "unavailable",
      reason: "This discount exceeds the entire configured daily budget.",
      reasons,
      simulated: true,
    };
  reasons.push("Your product minimum and maximum discount remain hard limits.");
  return {
    status: input.targetMinor >= amountMinor ? "accepted" : "counteroffer",
    amountMinor,
    discountMinor,
    floorMinor: floor,
    shippingReserveMinor: input.shippingReserveMinor,
    reasons,
    simulated: true,
  };
}
