-- The DNS verification flow runs as the restricted application role.
-- Grant only the single workspace column that this flow is allowed to change.
grant update(domain_verified) on negotiation.workspaces to negotiation_app;
