-- Platform-specific Neon schema; do not apply the historical Supabase draft.
create schema if not exists negotiation;
do $$ begin if not exists(select from pg_roles where rolname='negotiation_app') then create role negotiation_app nologin; end if; end $$;
grant negotiation_app to current_user;
grant usage on schema negotiation to negotiation_app;
create table if not exists negotiation.workspaces (
 id uuid primary key default gen_random_uuid(), owner_user_id text not null,
 name text not null, domain text not null, industry text not null, currency text not null check(currency in ('INR','USD','AED','EUR','GBP','SGD')),
 domain_verified boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists negotiation.products (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references negotiation.workspaces(id) on delete cascade,
 sku text not null, name text not null, price_minor integer not null check(price_minor>0), floor_minor integer not null check(floor_minor>0 and floor_minor<=price_minor),
 stock integer check(stock>=0), source text not null default 'manual', updated_at timestamptz not null default now(), unique(workspace_id,sku)
);
create table if not exists negotiation.policy_versions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references negotiation.workspaces(id) on delete cascade,
 version integer not null, config jsonb not null, created_at timestamptz not null default now(), unique(workspace_id,version)
);
create table if not exists negotiation.connections (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references negotiation.workspaces(id) on delete cascade,
 connector_id text not null, status text not null check(status in ('setup_required','manual_ready')),
 created_at timestamptz not null default now(), unique(workspace_id,connector_id)
);
create table if not exists negotiation.simulations (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references negotiation.workspaces(id) on delete cascade,
 policy_version integer not null, product_snapshot jsonb not null, input jsonb not null, result jsonb not null, created_at timestamptz not null default now()
);
create table if not exists negotiation.audit_events (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references negotiation.workspaces(id) on delete cascade,
 actor_user_id text not null, name text not null, detail text not null, created_at timestamptz not null default now()
);
alter table negotiation.workspaces enable row level security;
drop policy if exists owner_access on negotiation.workspaces;
create policy owner_access on negotiation.workspaces to negotiation_app using(owner_user_id=current_setting('app.user_id',true)) with check(owner_user_id=current_setting('app.user_id',true));
do $$ declare t text; begin
 foreach t in array array['products','policy_versions','connections','simulations','audit_events'] loop
 execute format('alter table negotiation.%I enable row level security',t);
 execute format('drop policy if exists tenant_access on negotiation.%I',t);
 execute format('create policy tenant_access on negotiation.%I to negotiation_app using(exists(select 1 from negotiation.workspaces w where w.id=workspace_id)) with check(exists(select 1 from negotiation.workspaces w where w.id=workspace_id))',t);
 end loop;
end $$;
grant select,insert on all tables in schema negotiation to negotiation_app;
grant update(name,price_minor,floor_minor,stock,source,updated_at) on negotiation.products to negotiation_app;
create index if not exists workspaces_owner on negotiation.workspaces(owner_user_id);
create index if not exists audit_workspace_time on negotiation.audit_events(workspace_id,created_at desc);
create index if not exists simulations_workspace_time on negotiation.simulations(workspace_id,created_at desc);
