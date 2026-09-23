-- Veyraflow — deterministic account deletion (SPEC §21.5)
-- Deletes workspaces owned by the profile BEFORE the profile row goes away, so the
-- CASCADE / SET NULL mix on child tables never races. Also anonymizes ledger/audit actors.
create or replace function public.profiles_before_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.allow_ledger_delete', 'on', true);
  delete from public.workspaces where owner_id = old.id;
  update public.credit_ledger set actor_id = null where actor_id = old.id;
  update public.audit_log set actor_id = null where actor_id = old.id;
  update public.moderation_events set prompt_excerpt = null where user_id = old.id;
  return old;
end $$;

create trigger profiles_before_delete
  before delete on public.profiles
  for each row execute function public.profiles_before_delete();

revoke execute on function public.profiles_before_delete() from public, anon, authenticated;
