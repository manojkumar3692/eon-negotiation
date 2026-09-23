-- Additive; legacy prices stay unconfirmed until a new connector sync.
alter table negotiation.products add column if not exists commerce_facts jsonb not null default '{}'::jsonb;
create table if not exists negotiation.invitations (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references negotiation.workspaces(id),
 installation_id uuid not null references negotiation.connector_installations(id), product_id uuid not null references negotiation.products(id),
 visitor_key text not null, token_hash text not null unique, settings_version integer not null,
 surface text not null, signals jsonb not null, expires_at timestamptz not null, consumed_at timestamptz,
 shown_at timestamptz, dismissed_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists invitation_visitor_idx on negotiation.invitations(workspace_id,visitor_key,created_at);
alter table negotiation.invitations enable row level security;
revoke all on negotiation.invitations from negotiation_app;
