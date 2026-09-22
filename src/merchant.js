// First merchant fixture. Production resolves merchant/catalog/policy from Supabase.
// This is not a live approved House of EON policy.
export const eon = {
 id: 'house-of-eon', name: 'House of EON',
 product: { title: 'Arctic Wave', size: '50 ml', scent: 'Fresh and clean', price: 99900 },
 policy: { floor: 87500, maxDiscountBps: 1250, stock: 10, enabled: true }
};
