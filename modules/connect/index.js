export const requiredOperations = ['capabilities','catalog','context','checkout','verifyWebhook'];
export function validateConnector(adapter) {
  if (!adapter || requiredOperations.some(key=>typeof adapter[key]!=='function')) throw Error('INCOMPLETE_CONNECTOR');
  return adapter;
}
// Channel presentation is separate from store checkout capabilities.
export const channels = {
  website:{phase:'pilot',surfaces:['product','chat','cart','exit_intent','dedicated_page']},
  shopify:{phase:'staging_acceptance',adapter:'lib/commerce/shopify.js'},
  custom:{phase:'staging_acceptance',adapter:'lib/commerce/custom.js'},
  woocommerce:{phase:'future'},whatsapp:{phase:'eon_recovery',requires:'opt-in and provider integration'},
  email:{phase:'eon_recovery',requires:'opt-in and provider integration'},instagram:{phase:'future_supported_api'},
  salesAgent:{phase:'future'},b2b:{phase:'future'},buyerAgent:{phase:'future_authenticated_api'}
};
