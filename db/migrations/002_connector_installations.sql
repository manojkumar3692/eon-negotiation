create table if not exists negotiation.connector_installations (
 id uuid primary key,
 workspace_id uuid not null references negotiation.workspaces(id) on delete cascade,
 connector_kind text not null default 'custom', endpoint text not null,
 credential_ciphertext text not null,
 status text not null default 'not_tested' check(status in ('not_tested','read_only','failed')),
 last_attempt_at timestamptz, last_success_at timestamptz,
 last_error text, last_result jsonb, request_id uuid,
 shipping_mode text not null default 'unconfigured' check(shipping_mode in ('unconfigured','flat','zone_table','live_quote')),
 created_at timestamptz not null default now(), unique(workspace_id,connector_kind)
);
alter table negotiation.connector_installations enable row level security;
drop policy if exists tenant_access on negotiation.connector_installations;
create policy tenant_access on negotiation.connector_installations to negotiation_app
 using(exists(select 1 from negotiation.workspaces w where w.id=workspace_id))
 with check(exists(select 1 from negotiation.workspaces w where w.id=workspace_id));
grant select,insert,update on negotiation.connector_installations to negotiation_app;
