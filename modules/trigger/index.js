// Only normalized, server-verified commerce/history facts belong here in production.
export function eligibility(signals, rule) {
  const no = reason => ({state:'no_negotiation',reasons:[reason]});
  if (!rule.enabled) return no('merchant_paused');
  if (signals.experimentArm === 'control') return no('control_group');
  if (!Number.isSafeInteger(signals.stock) || signals.stock <= rule.lowStock) return no('stock_protected');
  if (rule.excludeNewLaunch && signals.newLaunch) return no('new_launch_excluded');
  if (signals.cooldown || signals.alreadyPurchased) return no('invitation_suppressed');
  if(rule.match==='visits_and_dwell'&&!(signals.visits>=rule.minVisits&&signals.dwellSeconds>=rule.minDwellSeconds))return no('visit_and_dwell_required');
  const reasons = [];
  if (signals.visits >= rule.minVisits) reasons.push('repeat_interest');
  if (signals.dwellSeconds >= rule.minDwellSeconds) reasons.push('time_considering');
  if (signals.cartMinor >= rule.minCartMinor && signals.inCart) reasons.push('cart_interest');
  if (signals.checkoutHesitation && signals.inCart) reasons.push('checkout_hesitation');
  if (signals.abandonedCart && signals.recoveryConsent) reasons.push('consented_recovery');
  if (signals.returningCustomer && signals.inCart) reasons.push('returning_customer_cart');
  // Acquisition may target a merchant-approved campaign, never inferred ability to pay.
  if (rule.campaign && signals.verifiedCampaign === rule.campaign) reasons.push('approved_campaign');
  return {state:reasons.length >= 2 ? 'negotiation_recommended' : reasons.length ? 'negotiation_allowed':'no_negotiation',reasons};
}
export const surfaces = ['product','chat','cart','exit_intent','recovery_link','dedicated_page','api'];
