-- credit_ledger.actor_id is informational; anonymized explicitly by the account-deletion flow (SPEC §21.5)
alter table public.credit_ledger drop constraint credit_ledger_actor_id_fkey;
create index credit_ledger_actor_idx on public.credit_ledger (actor_id) where actor_id is not null;
