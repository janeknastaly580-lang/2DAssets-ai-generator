-- Veyraflow — security linter fixes
-- move citext out of public (no-op on fresh installs where 0001 already used schema extensions)
do $$ begin
  if exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
             where e.extname = 'citext' and n.nspname = 'public') then
    alter extension citext set schema extensions;
  end if;
end $$;

alter function public.set_updated_at() set search_path = public;
alter function public.credit_ledger_immutable() set search_path = public;
alter function public.profiles_restrict_self_update() set search_path = public;
alter function public.assets_restrict_client_update() set search_path = public;
alter function public.member_role_rank(public.member_role) set search_path = public;
alter function public.available_credits(public.credit_balances) set search_path = public;

-- is_member / is_admin are needed by RLS for signed-in users only
revoke execute on function public.is_member(uuid, public.member_role) from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.member_role_rank(public.member_role) from public, anon;
revoke execute on function public.available_credits(public.credit_balances) from public, anon;
