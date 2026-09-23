-- Veyraflow — explicit privileges for the Supabase API roles.
-- This project does not grant DML to anon/authenticated/service_role by default, and revoking
-- EXECUTE from PUBLIC (0003/0006) also removed the implicit grant for those roles.

-- service_role: full DML everywhere (RLS bypass) — used only by lib/supabase/admin.ts
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- authenticated: reads governed by RLS (§15.3) + the narrow writes allowed there
grant select on
  public.profiles, public.workspaces, public.workspace_members, public.workspace_invites,
  public.credit_balances, public.credit_ledger, public.projects, public.project_references,
  public.job_status_feed, public.assets, public.asset_files, public.share_links, public.downloads,
  public.model_pricing, public.feature_flags, public.voice_cache, public.moderation_events, public.audit_log,
  public.jobs_public
to authenticated;
grant select (id, workspace_id, project_id, user_id, type, status, progress, input, credits_estimated,
              credits_reserved, credits_charged, error_code, error_message, result_asset_ids,
              started_at, finished_at, created_at, updated_at)
  on public.jobs to authenticated;
grant update on public.profiles, public.workspaces, public.assets to authenticated;
grant insert, update, delete on public.projects to authenticated;
grant insert, delete on public.project_references to authenticated;

-- functions used by RLS / client RPC
grant execute on function public.member_role_rank(public.member_role) to authenticated;
grant execute on function public.is_member(uuid, public.member_role) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.available_credits(public.credit_balances) to authenticated;
grant execute on function public.my_workspaces() to authenticated;
grant execute on function public.workspace_balance(uuid) to authenticated;

-- anon: nothing beyond schema usage (public share pages are served by the server with service role)

-- future objects created by migrations (run as postgres)
alter default privileges for role postgres in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public grant usage, select on sequences to service_role;
alter default privileges for role postgres in schema public grant execute on functions to service_role;
