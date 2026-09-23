-- Veyraflow — credit_ledger stays append-only, but allows actor anonymization (GDPR) and cascade under flag
create or replace function public.credit_ledger_immutable() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_setting('app.allow_ledger_delete', true) = 'on' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'UPDATE'
     and new.actor_id is null and old.actor_id is not null
     and row(new.id, new.workspace_id, new.kind, new.bucket, new.delta, new.job_id, new.stripe_event_id, new.description, new.created_at)
         is not distinct from
         row(old.id, old.workspace_id, old.kind, old.bucket, old.delta, old.job_id, old.stripe_event_id, old.description, old.created_at)
  then
    return new; -- FK "on delete set null" anonymization only
  end if;
  raise exception 'credit_ledger is append-only';
end $$;
