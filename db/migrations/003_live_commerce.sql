-- Durable live-commerce state shared by custom stores and native adapters.
alter table negotiation.connector_installations
  add column if not exists provider text not null default 'custom',
  add column if not exists shop_domain text,
  add column if not exists refresh_credential_ciphertext text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists scopes text[] not null default '{}',
  add column if not exists config jsonb not null default '{}',
  add column if not exists public_key uuid not null default gen_random_uuid(),
  add column if not exists activation_status text not null default 'testing',
  add column if not exists revoked_at timestamptz;

alter table negotiation.connector_installations drop constraint if exists connector_installations_status_check;
alter table negotiation.connector_installations add constraint connector_installations_status_check
  check(status in ('not_tested','connected','read_only','ready','failed','revoked'));
alter table negotiation.connector_installations drop constraint if exists connector_installations_activation_status_check;
alter table negotiation.connector_installations add constraint connector_installations_activation_status_check
  check(activation_status in ('testing','active','paused'));
create unique index if not exists connector_public_key on negotiation.connector_installations(public_key);

alter table negotiation.products
  add column if not exists external_product_id text,
  add column if not exists external_variant_id text;
create unique index if not exists products_external_variant
  on negotiation.products(workspace_id,external_variant_id) where external_variant_id is not null;

alter table negotiation.workspaces
  add column if not exists domain_verification_token uuid not null default gen_random_uuid();

create table if not exists negotiation.oauth_states (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references negotiation.workspaces(id) on delete cascade,
 provider text not null,
 state_hash text not null unique,
 shop_domain text not null,
 expires_at timestamptz not null,
 consumed_at timestamptz,
 created_at timestamptz not null default now()
);

create table if not exists negotiation.live_sessions (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references negotiation.workspaces(id) on delete cascade,
 installation_id uuid not null references negotiation.connector_installations(id) on delete cascade,
 token_hash text not null,
 cart jsonb not null,
 context_snapshot jsonb not null,
 policy_version integer not null,
 round integer not null default 0,
 pending_target_minor integer,
 status text not null default 'open' check(status in ('open','accepted','expired','closed')),
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists live_sessions_workspace_time on negotiation.live_sessions(workspace_id,created_at desc);

create table if not exists negotiation.negotiation_turns (
 id bigserial primary key,
 session_id uuid not null references negotiation.live_sessions(id) on delete cascade,
 role text not null check(role in ('customer','assistant','system')),
 kind text not null,
 content text not null,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create index if not exists turns_session_time on negotiation.negotiation_turns(session_id,id);

create table if not exists negotiation.live_quotes (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references negotiation.live_sessions(id) on delete cascade,
 workspace_id uuid not null references negotiation.workspaces(id) on delete cascade,
 policy_version integer not null,
 amount_minor integer not null check(amount_minor>0),
 baseline_minor integer not null check(baseline_minor>=amount_minor),
 shipping_minor integer not null default 0 check(shipping_minor>=0),
 currency text not null,
 context_revision text not null,
 cart_fingerprint text not null,
 status text not null default 'offered' check(status in ('offered','accepted','expired','superseded','failed')),
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index if not exists live_quotes_session_time on negotiation.live_quotes(session_id,created_at desc);

create table if not exists negotiation.budget_reservations (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references negotiation.workspaces(id) on delete cascade,
 quote_id uuid not null unique references negotiation.live_quotes(id) on delete cascade,
 discount_minor integer not null check(discount_minor>=0),
 status text not null default 'reserved' check(status in ('reserved','committed','released')),
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists budget_workspace_day on negotiation.budget_reservations(workspace_id,created_at);

create table if not exists negotiation.checkout_attempts (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references negotiation.workspaces(id) on delete cascade,
 session_id uuid not null references negotiation.live_sessions(id) on delete cascade,
 quote_id uuid not null references negotiation.live_quotes(id),
 idempotency_key text not null,
 request_hash text not null,
 status text not null default 'started' check(status in ('started','created','paid','failed','refunded')),
 external_id text,
 checkout_url text,
 response jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(session_id,idempotency_key)
);

create table if not exists negotiation.webhook_inbox (
 id bigserial primary key,
 provider text not null,
 event_id text not null,
 shop_domain text,
 topic text not null,
 payload jsonb not null,
 status text not null default 'received' check(status in ('received','processed','ignored','failed')),
 received_at timestamptz not null default now(),
 processed_at timestamptz,
 unique(provider,event_id)
);

alter table negotiation.oauth_states enable row level security;
drop policy if exists tenant_access on negotiation.oauth_states;
create policy tenant_access on negotiation.oauth_states to negotiation_app
 using(exists(select 1 from negotiation.workspaces w where w.id=workspace_id))
 with check(exists(select 1 from negotiation.workspaces w where w.id=workspace_id));
alter table negotiation.live_sessions enable row level security;
drop policy if exists tenant_access on negotiation.live_sessions;
create policy tenant_access on negotiation.live_sessions to negotiation_app
 using(exists(select 1 from negotiation.workspaces w where w.id=workspace_id))
 with check(exists(select 1 from negotiation.workspaces w where w.id=workspace_id));
alter table negotiation.live_quotes enable row level security;
drop policy if exists tenant_access on negotiation.live_quotes;
create policy tenant_access on negotiation.live_quotes to negotiation_app
 using(exists(select 1 from negotiation.workspaces w where w.id=workspace_id))
 with check(exists(select 1 from negotiation.workspaces w where w.id=workspace_id));
alter table negotiation.budget_reservations enable row level security;
drop policy if exists tenant_access on negotiation.budget_reservations;
create policy tenant_access on negotiation.budget_reservations to negotiation_app
 using(exists(select 1 from negotiation.workspaces w where w.id=workspace_id))
 with check(exists(select 1 from negotiation.workspaces w where w.id=workspace_id));
alter table negotiation.checkout_attempts enable row level security;
drop policy if exists tenant_access on negotiation.checkout_attempts;
create policy tenant_access on negotiation.checkout_attempts to negotiation_app
 using(exists(select 1 from negotiation.workspaces w where w.id=workspace_id))
 with check(exists(select 1 from negotiation.workspaces w where w.id=workspace_id));
alter table negotiation.negotiation_turns enable row level security;
drop policy if exists tenant_access on negotiation.negotiation_turns;
create policy tenant_access on negotiation.negotiation_turns to negotiation_app
 using(exists(select 1 from negotiation.live_sessions s join negotiation.workspaces w on w.id=s.workspace_id where s.id=session_id))
 with check(exists(select 1 from negotiation.live_sessions s join negotiation.workspaces w on w.id=s.workspace_id where s.id=session_id));

grant select,insert,update on negotiation.connector_installations,negotiation.oauth_states,negotiation.live_sessions,
 negotiation.negotiation_turns,negotiation.live_quotes,negotiation.budget_reservations,negotiation.checkout_attempts to negotiation_app;
grant delete on negotiation.oauth_states to negotiation_app;
grant usage,select on sequence negotiation.negotiation_turns_id_seq to negotiation_app;
grant update(source,external_product_id,external_variant_id,updated_at) on negotiation.products to negotiation_app;
