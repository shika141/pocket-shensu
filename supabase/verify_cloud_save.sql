-- Run after schema.sql in Supabase SQL Editor.
-- Expected: authenticated can SELECT and EXECUTE, but cannot INSERT/UPDATE/DELETE directly;
-- anon cannot read or execute; the function owner is postgres with prosecdef = true.

select
  c.relrowsecurity as rls_enabled,
  pg_catalog.pg_get_userbyid(c.relowner) as table_owner,
  has_schema_privilege('authenticated', 'public', 'USAGE') as authenticated_can_use_public_schema,
  has_schema_privilege('authenticated', 'auth', 'USAGE') as authenticated_can_use_auth_schema
from pg_catalog.pg_class c
where c.oid = 'public.game_saves'::regclass;

select role_name,
       has_table_privilege(role_name, 'public.game_saves', 'SELECT') as can_select,
       has_table_privilege(role_name, 'public.game_saves', 'INSERT') as can_insert,
       has_table_privilege(role_name, 'public.game_saves', 'UPDATE') as can_update,
       has_table_privilege(role_name, 'public.game_saves', 'DELETE') as can_delete
from (values ('authenticated'), ('anon')) as roles(role_name);

select
  pg_catalog.pg_get_userbyid(p.proowner) as function_owner,
  p.prosecdef as security_definer,
  p.proconfig as function_settings,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'save_game_state'
  and p.oid = 'public.save_game_state(uuid, integer, jsonb)'::regprocedure;

select policyname, cmd, roles, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public' and tablename = 'game_saves';

-- The Supabase Dashboard controls whether `public` is an Exposed schema and whether
-- the Data API is enabled; verify those settings in Project Settings > API.
