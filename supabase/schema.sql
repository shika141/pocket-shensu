-- Pocket Shensu · cloud-save schema v2
-- Run in Supabase Dashboard > SQL Editor as the project postgres role.
-- Expose the public schema in Project Settings > API > Exposed schemas and keep Data API enabled.

create table if not exists public.game_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.game_saves owner to postgres;
alter table public.game_saves enable row level security;

-- Remove any older or overly broad policies so authenticated clients can only read their own row.
do $$
declare policy_row record;
begin
  for policy_row in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'game_saves'
  loop
    execute format('drop policy if exists %I on public.game_saves', policy_row.policyname);
  end loop;
end;
$$;

create policy "Players can read their own save" on public.game_saves
  for select to authenticated using ((select auth.uid()) = user_id);

-- Remove direct table writes. All authenticated writes must use save_game_state.
revoke all privileges on table public.game_saves from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on table public.game_saves to authenticated;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

create or replace function public.save_game_state(
  p_user_id uuid,
  p_expected_revision integer,
  p_state jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved public.game_saves%rowtype;
begin
  if auth.uid() is null or auth.uid() is distinct from p_user_id then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode = '22023', message = 'expected revision must be a non-negative integer';
  end if;
  if p_state is null or pg_catalog.jsonb_typeof(p_state) <> 'object' then
    raise exception using errcode = '22023', message = 'state must be a JSON object';
  end if;

  if p_expected_revision = 0 then
    -- First-save race: exactly one caller inserts. A competing INSERT waits for
    -- the winner, does nothing on the PK conflict, then reads and returns the
    -- winner's row as a normal conflict response instead of leaking a 23505.
    insert into public.game_saves(user_id, state, revision, updated_at)
      values (p_user_id, p_state, 1, pg_catalog.now())
      on conflict (user_id) do nothing
      returning * into saved;
    if found then
      return pg_catalog.jsonb_build_object(
        'status', 'saved',
        'save', pg_catalog.jsonb_build_object(
          'state', saved.state,
          'revision', saved.revision,
          'updated_at', saved.updated_at
        )
      );
    end if;
  else
    -- Atomic compare-and-swap for existing saves. Concurrent calls with the
    -- same expected revision cannot both update the row.
    update public.game_saves
       set state = p_state,
           revision = public.game_saves.revision + 1,
           updated_at = pg_catalog.now()
     where user_id = p_user_id
       and revision = p_expected_revision
     returning * into saved;
    if found then
      return pg_catalog.jsonb_build_object(
        'status', 'saved',
        'save', pg_catalog.jsonb_build_object(
          'state', saved.state,
          'revision', saved.revision,
          'updated_at', saved.updated_at
        )
      );
    end if;
  end if;

  -- A missing row for a stale non-zero revision is also a conflict. The client
  -- must not silently recreate it from a stale snapshot.
  select * into saved
    from public.game_saves
   where user_id = p_user_id;
  if found then
    return pg_catalog.jsonb_build_object(
      'status', 'conflict',
      'save', pg_catalog.jsonb_build_object(
        'state', saved.state,
        'revision', saved.revision,
        'updated_at', saved.updated_at
      )
    );
  end if;
  return pg_catalog.jsonb_build_object('status', 'conflict', 'save', null);
end;
$$;

-- Supabase SQL Editor runs as postgres. Pin the SECURITY DEFINER owner explicitly.
alter function public.save_game_state(uuid, integer, jsonb) owner to postgres;
revoke all privileges on function public.save_game_state(uuid, integer, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.save_game_state(uuid, integer, jsonb) to authenticated;

-- Make PostgREST see the function signature immediately after the migration.
notify pgrst, 'reload schema';
