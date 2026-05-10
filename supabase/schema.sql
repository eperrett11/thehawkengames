create table if not exists public.app_state (
  id text primary key default 'main',
  state jsonb not null,
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint app_state_singleton check (id = 'main')
);

alter table public.app_state enable row level security;

drop policy if exists "app_state_no_direct_read" on public.app_state;
drop policy if exists "app_state_no_direct_insert" on public.app_state;
drop policy if exists "app_state_no_direct_update" on public.app_state;

create or replace function public.get_app_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data public.app_state%rowtype;
begin
  select * into row_data
  from public.app_state
  where id = 'main';

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'state', row_data.state,
    'revision', row_data.revision
  );
end;
$$;

create or replace function public.seed_app_state(new_state jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data public.app_state%rowtype;
begin
  insert into public.app_state (id, state, revision, updated_at)
  values ('main', new_state, 1, now())
  on conflict (id) do nothing;

  select * into row_data
  from public.app_state
  where id = 'main';

  return jsonb_build_object(
    'state', row_data.state,
    'revision', row_data.revision
  );
end;
$$;

create or replace function public.commit_app_state(new_state jsonb, expected_revision integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data public.app_state%rowtype;
begin
  update public.app_state
  set
    state = new_state,
    revision = revision + 1,
    updated_at = now()
  where id = 'main'
    and revision = expected_revision
  returning * into row_data;

  if not found then
    raise exception 'STATE_CONFLICT'
      using hint = 'The tournament state changed before this save completed. Reload and try again.';
  end if;

  return jsonb_build_object(
    'state', row_data.state,
    'revision', row_data.revision
  );
end;
$$;

revoke all on function public.get_app_state() from anon, authenticated;
revoke all on function public.seed_app_state(jsonb) from anon, authenticated;
revoke all on function public.commit_app_state(jsonb, integer) from anon, authenticated;

grant execute on function public.get_app_state() to service_role;
grant execute on function public.seed_app_state(jsonb) to service_role;
grant execute on function public.commit_app_state(jsonb, integer) to service_role;
