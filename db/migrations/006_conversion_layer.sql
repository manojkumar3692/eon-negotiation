-- Additive Neon schema. Review/test on isolated development branch before applying.
-- Existing price-only service remains unchanged. New tables are NOT seeded with sample prices.
do $$ begin
 if not exists(select 1 from pg_constraint where conname='products_workspace_id_id_key' and conrelid='negotiation.products'::regclass) then
 alter table negotiation.products add constraint products_workspace_id_id_key unique(workspace_id,id); end if;
 if not exists(select 1 from pg_constraint where conname='sessions_workspace_id_id_key' and conrelid='negotiation.live_sessions'::regclass) then
 alter table negotiation.live_sessions add constraint sessions_workspace_id_id_key unique(workspace_id,id); end if;
 if not exists(select 1 from pg_constraint where conname='quotes_workspace_id_id_key' and conrelid='negotiation.live_quotes'::regclass) then
 alter table negotiation.live_quotes add constraint quotes_workspace_id_id_key unique(workspace_id,id); end if;
end $$;

create table if not exists negotiation.onboarding_drafts (
 workspace_id uuid primary key references negotiation.workspaces(id),
 step integer not null default 0 check(step between 0 and 7),
 revision integer not null default 1 check(revision>0),
 draft jsonb not null default '{}', readiness jsonb not null default '{}',
 updated_at timestamptz not null default now()
);
create table if not exists negotiation.product_rule_versions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references negotiation.workspaces(id),
 product_id uuid not null, version integer not null check(version>0),
 public_minor bigint not null check(public_minor>0), target_minor bigint not null,
 floor_minor bigint not null check(floor_minor>0), cost_minor bigint not null check(cost_minor>=0),
 currency text not null check(currency ~ '^[A-Z]{3}$'), tax_basis text not null check(tax_basis in ('inclusive','exclusive')),
 strategy text not null check(strategy in ('protect_margin','balanced','maximize_conversion','clear_inventory')),
 concessions jsonb not null default '[]', limits jsonb not null, approved_by text not null,
 created_at timestamptz not null default now(),
 check(floor_minor<=target_minor and target_minor<=public_minor),
 unique(workspace_id,product_id,version),unique(workspace_id,id),
 foreign key(workspace_id,product_id) references negotiation.products(workspace_id,id)
);
create table if not exists negotiation.trigger_versions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references negotiation.workspaces(id),
 version integer not null check(version>0), rules jsonb not null, exclusions jsonb not null default '{}',
 created_by text not null, created_at timestamptz not null default now(),unique(workspace_id,version)
);
create table if not exists negotiation.experiments (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references negotiation.workspaces(id),
 name text not null,plan jsonb not null,treatment_bps integer not null check(treatment_bps between 1 and 9999),
 status text not null default 'draft' check(status in ('draft','running','paused','completed')),
 starts_at timestamptz,ends_at timestamptz,unique(workspace_id,id),check(ends_at is null or ends_at>starts_at)
);
create table if not exists negotiation.experiment_assignments (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,experiment_id uuid not null,
 visitor_key text not null,arm text not null check(arm in ('control','treatment')),assigned_at timestamptz not null default now(),
 unique(workspace_id,id),unique(experiment_id,visitor_key),
 foreign key(workspace_id,experiment_id) references negotiation.experiments(workspace_id,id)
);
create table if not exists negotiation.conversion_events (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references negotiation.workspaces(id),
 event_key text not null,event_type text not null check(event_type in (
 'eligibility_evaluated','experiment_assigned','invitation_shown','invitation_dismissed','negotiation_started',
 'intent_confirmed','offer_created','offer_accepted','checkout_created','order_paid','order_cancelled',
 'order_refunded','recovery_invited','recovery_opened','policy_published','merchant_paused')),
 mode text not null check(mode in ('sandbox','live')),schema_version integer not null default 1,
 visitor_key text,assignment_id uuid,session_id uuid,quote_id uuid,
 occurred_at timestamptz not null default now(),properties jsonb not null default '{}',
 unique(workspace_id,event_key),
 foreign key(workspace_id,assignment_id) references negotiation.experiment_assignments(workspace_id,id),
 foreign key(workspace_id,session_id) references negotiation.live_sessions(workspace_id,id),
 foreign key(workspace_id,quote_id) references negotiation.live_quotes(workspace_id,id)
);
create index if not exists conversion_events_funnel on negotiation.conversion_events(workspace_id,mode,occurred_at,event_type);
create table if not exists negotiation.offer_grants (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references negotiation.workspaces(id),
 purpose text not null check(purpose in ('recovery','checkout')),token_hash text not null unique,
 session_id uuid,quote_id uuid,cart_hash text not null,
 expires_at timestamptz not null,consumed_at timestamptz,revoked_at timestamptz,
 created_at timestamptz not null default now(),unique(workspace_id,id),check(expires_at>created_at),
 check(purpose<>'checkout' or (session_id is not null and quote_id is not null)),
 foreign key(workspace_id,session_id) references negotiation.live_sessions(workspace_id,id),
 foreign key(workspace_id,quote_id) references negotiation.live_quotes(workspace_id,id)
);
create table if not exists negotiation.recovery_invitations (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references negotiation.workspaces(id),
 grant_id uuid not null,channel text not null check(channel in ('email','whatsapp')),
 recipient_reference text not null,consent_reference text not null,abandoned_cart_reference text not null,
 status text not null default 'pending' check(status in ('pending','sent','suppressed','failed','converted')),
 send_after timestamptz not null,created_at timestamptz not null default now(),
 unique(workspace_id,channel,abandoned_cart_reference),
 foreign key(workspace_id,grant_id) references negotiation.offer_grants(workspace_id,id)
);
create table if not exists negotiation.delivery_outbox (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references negotiation.workspaces(id),
 topic text not null check(topic in ('create_checkout','send_recovery','reconcile_order')),
 idempotency_key text not null,payload jsonb not null,status text not null default 'pending' check(status in ('pending','working','done','dead')),
 attempts integer not null default 0 check(attempts>=0),available_at timestamptz not null default now(),
 lease_until timestamptz,last_error_code text,created_at timestamptz not null default now(),
 unique(workspace_id,topic,idempotency_key)
);
-- Distributed fixed-window buckets: increment under row lock/upsert; never client-authoritative.
create table if not exists negotiation.rate_buckets (
 workspace_id uuid not null references negotiation.workspaces(id),bucket_key text not null,
 window_start timestamptz not null,request_count integer not null check(request_count>=0),
 primary key(workspace_id,bucket_key,window_start)
);

do $$ declare t text; begin
 foreach t in array array['onboarding_drafts','product_rule_versions','trigger_versions','experiments',
 'experiment_assignments','conversion_events','offer_grants','recovery_invitations','delivery_outbox','rate_buckets'] loop
 execute format('alter table negotiation.%I enable row level security',t);
 -- Migration 001 re-grants broadly on reruns: reset grants explicitly here.
 execute format('revoke all on negotiation.%I from negotiation_app',t);
 execute format('drop policy if exists tenant_access on negotiation.%I',t);
 execute format('create policy tenant_access on negotiation.%I to negotiation_app using(exists(select 1 from negotiation.workspaces w where w.id=workspace_id)) with check(exists(select 1 from negotiation.workspaces w where w.id=workspace_id))',t);
 end loop;
end $$;
-- Operational token/outbox/rate tables have NO client-role grants. Server capability service only.
grant select,insert,update on negotiation.onboarding_drafts to negotiation_app;
grant select,insert on negotiation.product_rule_versions,negotiation.trigger_versions,negotiation.experiments to negotiation_app;
grant select on negotiation.experiment_assignments,negotiation.conversion_events to negotiation_app;
-- Immutable rules and events: no UPDATE/DELETE grants to the restricted merchant role.
