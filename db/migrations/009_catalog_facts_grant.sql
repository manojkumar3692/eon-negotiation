-- Catalog synchronization updates authoritative imported price and store terms.
-- Keep the existing tenant RLS and column-scoped update permissions.
grant update(commerce_facts) on negotiation.products to negotiation_app;
