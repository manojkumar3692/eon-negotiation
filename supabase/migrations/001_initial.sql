-- Initial schema, intended for a fresh Supabase project. Not yet applied.
create table public.merchants (
 id uuid primary key default gen_random_uuid(), name text not null, domain text not null unique,
 enabled boolean not null default false, created_at timestamptz not null default now()
);
create table public.memberships (
 merchant_id uuid references public.merchants(id), user_id uuid references auth.users(id),
 role text not null check(role in ('owner','operator','analyst')), primary key(merchant_id,user_id)
);
create table public.products (
 id uuid primary key default gen_random_uuid(), merchant_id uuid not null references public.merchants(id),
 external_variant_id text not null, title text not null, currency text not null check(currency='INR'),
 price_paise integer not null check(price_paise>0), stock integer not null check(stock>=0),
 synced_at timestamptz not null, unique(merchant_id,id), unique(merchant_id,external_variant_id)
);
create table public.policies (
 id uuid primary key default gen_random_uuid(), merchant_id uuid not null references public.merchants(id),
 product_id uuid not null, version integer not null check(version>0), enabled boolean not null default false,
 floor_paise integer not null check(floor_paise>0), max_discount_bps integer not null check(max_discount_bps between 0 and 10000),
 daily_budget_paise integer not null check(daily_budget_paise>=0), max_rounds integer not null default 3 check(max_rounds=3),
 ttl_seconds integer not null default 900 check(ttl_seconds between 60 and 1800),
 created_at timestamptz not null default now(), unique(merchant_id,id), unique(merchant_id,product_id,version),
 foreign key(merchant_id,product_id) references public.products(merchant_id,id)
);
create table public.sessions (
 id uuid primary key default gen_random_uuid(), merchant_id uuid not null references public.merchants(id),
 product_id uuid not null, policy_id uuid not null, token_hash text not null unique,
 channel text not null check(channel in ('widget','agent')), quantity integer not null default 1 check(quantity=1),
 currency text not null default 'INR' check(currency='INR'), round integer not null default 0 check(round between 0 and 3),
 status text not null default 'active' check(status in ('active','accepted','expired','closed')),
 experiment_arm text not null check(experiment_arm in ('control','treatment')),
 created_at timestamptz not null default now(), expires_at timestamptz not null,
 unique(merchant_id,id), foreign key(merchant_id,product_id) references public.products(merchant_id,id),
 foreign key(merchant_id,policy_id) references public.policies(merchant_id,id)
);
create table public.offers (
 id uuid primary key default gen_random_uuid(), merchant_id uuid not null, session_id uuid not null,
 round integer not null check(round between 1 and 3), amount_paise integer not null check(amount_paise>0),
 status text not null check(status in ('offered','accepted','superseded','expired','revoked')),
 expires_at timestamptz not null, created_at timestamptz not null default now(),
 unique(merchant_id,id), unique(session_id,round), foreign key(merchant_id,session_id) references public.sessions(merchant_id,id)
);
create unique index one_accepted_offer on public.offers(session_id) where status='accepted';
create table public.redemptions (
 id uuid primary key default gen_random_uuid(), merchant_id uuid not null, offer_id uuid not null unique,
 provider text not null, external_checkout_id text, external_order_id text,
 status text not null check(status in ('pending','ready','paid','failed','refunded')),
 created_at timestamptz not null default now(), foreign key(merchant_id,offer_id) references public.offers(merchant_id,id),
 unique(merchant_id,external_order_id)
);
create table public.idempotency_keys (
 merchant_id uuid not null references public.merchants(id), principal_hash text not null, route text not null,
 key text not null, request_hash text not null, response jsonb, expires_at timestamptz not null,
 primary key(merchant_id,principal_hash,route,key)
);
create table public.budget_days (
 merchant_id uuid not null references public.merchants(id), day date not null,
 reserved_paise integer not null default 0 check(reserved_paise>=0), spent_paise integer not null default 0 check(spent_paise>=0),
 primary key(merchant_id,day)
);
create table public.events (
 id uuid primary key default gen_random_uuid(), merchant_id uuid not null references public.merchants(id),
 session_id uuid, name text not null, schema_version integer not null default 1,
 properties jsonb not null default '{}', created_at timestamptz not null default now(),
 foreign key(merchant_id,session_id) references public.sessions(merchant_id,id)
);
create table public.webhook_receipts (
 merchant_id uuid not null references public.merchants(id), provider text not null, external_event_id text not null,
 received_at timestamptz not null default now(), processed_at timestamptz,
 primary key(merchant_id,provider,external_event_id)
);
create table public.outbox (
 id uuid primary key default gen_random_uuid(), merchant_id uuid not null references public.merchants(id),
 kind text not null, payload jsonb not null, attempts integer not null default 0,
 available_at timestamptz not null default now(), completed_at timestamptz
);
-- No direct shopper access. Backend must enforce tenant and session ownership even with service_role.
-- Merchant UI is read-only initially. Policy writes require audited server routes.
alter table public.memberships enable row level security;
create policy own_membership on public.memberships for select to authenticated using(user_id=auth.uid());
alter table public.merchants enable row level security;
create policy member_merchant on public.merchants for select to authenticated using(
 exists(select 1 from public.memberships m where m.merchant_id=id and m.user_id=auth.uid())
);
do $$ declare t text; begin
 foreach t in array array['products','policies','sessions','offers','redemptions','events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy member_read on public.%I for select to authenticated using (exists(select 1 from public.memberships m where m.merchant_id=%I.merchant_id and m.user_id=auth.uid()))',t,t);
 end loop;
 foreach t in array array['idempotency_keys','budget_days','webhook_receipts','outbox'] loop
 execute format('alter table public.%I enable row level security',t);
 end loop;
end $$;
create index events_merchant_time on public.events(merchant_id,created_at);
create index sessions_expiry on public.sessions(expires_at) where status='active';
