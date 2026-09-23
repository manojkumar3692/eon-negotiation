create table if not exists negotiation.conversion_settings (
 workspace_id uuid primary key references negotiation.workspaces(id),version integer not null default 1,
 config jsonb not null,status text not null default 'draft' check(status in ('draft','active','paused')),
 updated_at timestamptz not null default now(),updated_by text not null
);
create table if not exists negotiation.conversion_setting_history (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references negotiation.workspaces(id),
 version integer not null,config jsonb not null,actor text not null,created_at timestamptz not null default now(),unique(workspace_id,version)
);
create table if not exists negotiation.conversion_tests (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references negotiation.workspaces(id),
 settings_version integer not null,input jsonb not null,result jsonb not null,created_at timestamptz not null default now()
);
alter table negotiation.live_sessions add column if not exists conversion_version integer,
 add column if not exists surface text not null default 'dedicated_page',add column if not exists visitor_key text,
 add column if not exists recovery_grant_id uuid references negotiation.offer_grants(id);
do $$ declare t text;begin
 foreach t in array array['conversion_settings','conversion_setting_history','conversion_tests'] loop
 execute format('alter table negotiation.%I enable row level security',t);
 execute format('drop policy if exists tenant_access on negotiation.%I',t);
 execute format('create policy tenant_access on negotiation.%I to negotiation_app using(exists(select 1 from negotiation.workspaces w where w.id=workspace_id)) with check(exists(select 1 from negotiation.workspaces w where w.id=workspace_id))',t);
 execute format('revoke all on negotiation.%I from negotiation_app',t);
 end loop;
end $$;
grant select,insert,update on negotiation.conversion_settings to negotiation_app;
grant select,insert on negotiation.conversion_setting_history,negotiation.conversion_tests to negotiation_app;
-- Recovery grants are capability secrets: use a narrow owner-checked function, not broad table access.
create or replace function negotiation.create_recovery_grant(wid uuid, digest text, cart text, seconds integer)
returns table(id uuid,expires_at timestamptz) language plpgsql security definer set search_path=pg_catalog,negotiation as $$
begin
 if not exists(select 1 from negotiation.workspaces where workspaces.id=wid and owner_user_id=current_setting('app.user_id',true)) then raise exception 'NOT_FOUND';end if;
 if seconds<60 or seconds>86400 or length(digest)<>64 then raise exception 'INVALID_GRANT';end if;
 return query insert into negotiation.offer_grants(workspace_id,purpose,token_hash,cart_hash,expires_at)
 values(wid,'recovery',digest,cart,now()+seconds*interval '1 second') returning offer_grants.id,offer_grants.expires_at;
end $$;
revoke all on function negotiation.create_recovery_grant(uuid,text,text,integer) from public;
grant execute on function negotiation.create_recovery_grant(uuid,text,text,integer) to negotiation_app;
