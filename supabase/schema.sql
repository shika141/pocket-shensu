-- Pocket Shensu · schema v1
-- Run this file in Supabase Dashboard > SQL Editor.
create table if not exists public.game_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.game_saves enable row level security;
drop policy if exists "Players can read their own save" on public.game_saves;
create policy "Players can read their own save" on public.game_saves
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Players can insert their own save" on public.game_saves;
create policy "Players can insert their own save" on public.game_saves
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Players can update their own save" on public.game_saves;
create policy "Players can update their own save" on public.game_saves
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.game_saves from anon;
-- Client roles only read directly. Writes go through the revision-checked SECURITY DEFINER RPC.
revoke insert, update, delete on public.game_saves from authenticated;
grant select on public.game_saves to authenticated;

create or replace function public.save_game_state(
  p_user_id uuid,
  p_expected_revision integer,
  p_state jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare saved public.game_saves%rowtype;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'not authorized';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'invalid state payload';
  end if;

  select * into saved from public.game_saves where user_id = p_user_id for update;
  if not found then
    if p_expected_revision <> 0 then
      return jsonb_build_object('conflict', true, 'revision', 0);
    end if;
    insert into public.game_saves(user_id, state, revision, updated_at)
      values (p_user_id, p_state, 1, now())
      on conflict (user_id) do nothing
      returning * into saved;
    if found then
      return jsonb_build_object('state', saved.state, 'revision', saved.revision, 'updated_at', saved.updated_at);
    end if;
    select * into saved from public.game_saves where user_id = p_user_id for update;
  end if;

  if saved.revision <> p_expected_revision then
    return jsonb_build_object('conflict', true, 'state', saved.state, 'revision', saved.revision, 'updated_at', saved.updated_at);
  end if;
  update public.game_saves set state = p_state, revision = saved.revision + 1, updated_at = now()
    where user_id = p_user_id returning * into saved;
  return jsonb_build_object('state', saved.state, 'revision', saved.revision, 'updated_at', saved.updated_at);
end;
$$;
revoke all on function public.save_game_state(uuid, integer, jsonb) from public, anon;
grant execute on function public.save_game_state(uuid, integer, jsonb) to authenticated;
