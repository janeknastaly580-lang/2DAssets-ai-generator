-- Veyraflow — functions, triggers, RPC (SPEC §15.2)

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger workspaces_set_updated_at before update on public.workspaces for each row execute function public.set_updated_at();
create trigger credit_balances_set_updated_at before update on public.credit_balances for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger jobs_set_updated_at before update on public.jobs for each row execute function public.set_updated_at();
create trigger assets_set_updated_at before update on public.assets for each row execute function public.set_updated_at();
create trigger model_pricing_set_updated_at before update on public.model_pricing for each row execute function public.set_updated_at();
create trigger feature_flags_set_updated_at before update on public.feature_flags for each row execute function public.set_updated_at();
create trigger voice_cache_set_updated_at before update on public.voice_cache for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- New auth user → profile, personal workspace, membership, balances, Scratch project
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text;
  v_ws uuid;
  v_slug text;
begin
  v_name := coalesce(
    nullif(v_meta->>'display_name', ''),
    nullif(v_meta->>'full_name', ''),
    nullif(v_meta->>'name', ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, email, display_name, tos_accepted_at, tos_version, marketing_consent)
  values (
    new.id,
    new.email,
    v_name,
    case when nullif(v_meta->>'tos_version', '') is not null then now() else null end,
    nullif(v_meta->>'tos_version', ''),
    coalesce((v_meta->>'marketing_consent')::boolean, false)
  );

  v_slug := 'u-' || left(replace(new.id::text, '-', ''), 8);
  insert into public.workspaces (name, slug, type, owner_id)
  values (v_name, v_slug, 'personal', new.id)
  returning id into v_ws;

  insert into public.workspace_members (workspace_id, user_id, role) values (v_ws, new.id, 'owner');
  insert into public.credit_balances (workspace_id) values (v_ws);
  insert into public.projects (workspace_id, name, slug, description, is_scratch, created_by)
  values (v_ws, 'Scratch', 'scratch', 'Quick experiments without a style guide.', true, new.id);

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in sync with auth.users.email
create or replace function public.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- credit_ledger is append-only (delete allowed only when cascading a workspace
-- delete under the app.allow_ledger_delete setting)
-- ---------------------------------------------------------------------------
create or replace function public.credit_ledger_immutable() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and current_setting('app.allow_ledger_delete', true) = 'on' then
    return old;
  end if;
  raise exception 'credit_ledger is append-only';
end $$;

create trigger credit_ledger_no_update_delete
  before update or delete on public.credit_ledger
  for each row execute function public.credit_ledger_immutable();

-- ---------------------------------------------------------------------------
-- Restrict which profile columns a user may change themselves (SPEC §15.3)
-- ---------------------------------------------------------------------------
create or replace function public.profiles_restrict_self_update() returns trigger
language plpgsql as $$
begin
  -- service role / postgres have no auth.uid(); only restrict end users
  if auth.uid() is not null and auth.uid() = old.id and not public.is_admin() then
    if new.id is distinct from old.id
      or new.email is distinct from old.email
      or new.role is distinct from old.role
      or new.tos_accepted_at is distinct from old.tos_accepted_at
      or new.tos_version is distinct from old.tos_version
      or new.trial_used_at is distinct from old.trial_used_at
      or new.violations_month is distinct from old.violations_month
      or new.violations_reset_at is distinct from old.violations_reset_at
      or new.banned_at is distinct from old.banned_at
      or new.ban_reason is distinct from old.ban_reason
      or new.deletion_requested_at is distinct from old.deletion_requested_at
      or new.created_at is distinct from old.created_at
    then
      raise exception 'You may only change display_name, avatar_key, marketing_consent, notification_prefs and cookie_consent';
    end if;
  end if;
  return new;
end $$;

-- Restrict which asset columns a member may change from the client
create or replace function public.assets_restrict_client_update() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.id is distinct from old.id
      or new.workspace_id is distinct from old.workspace_id
      or new.type is distinct from old.type
      or new.slug is distinct from old.slug
      or new.status is distinct from old.status
      or new.source_job_id is distinct from old.source_job_id
      or new.parent_asset_id is distinct from old.parent_asset_id
      or new.prompt is distinct from old.prompt
      or new.metadata is distinct from old.metadata
      or new.preview_key is distinct from old.preview_key
      or new.animated_preview_key is distinct from old.animated_preview_key
      or new.size_bytes is distinct from old.size_bytes
      or new.created_by is distinct from old.created_by
      or new.expires_at is distinct from old.expires_at
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Only name, tags, project_id and deleted_at can be changed from the client';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Membership helpers (used by RLS)
-- ---------------------------------------------------------------------------
create or replace function public.member_role_rank(r public.member_role) returns int
language sql immutable as $$
  select case r when 'owner' then 4 when 'admin' then 3 when 'member' then 2 when 'viewer' then 1 end
$$;

create or replace function public.is_member(ws uuid, min_role public.member_role default 'viewer') returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
      and public.member_role_rank(m.role) >= public.member_role_rank(min_role)
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

-- now that is_admin exists, attach the restricting triggers
create trigger profiles_restrict_self_update before update on public.profiles
  for each row execute function public.profiles_restrict_self_update();
create trigger assets_restrict_client_update before update on public.assets
  for each row execute function public.assets_restrict_client_update();

-- ---------------------------------------------------------------------------
-- job_status_feed sync (narrow realtime projection)
-- ---------------------------------------------------------------------------
create or replace function public.sync_job_status_feed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.job_status_feed (job_id, workspace_id, user_id, type, status, progress, error_code, result_asset_ids, updated_at)
  values (new.id, new.workspace_id, new.user_id, new.type, new.status, new.progress, new.error_code, new.result_asset_ids, now())
  on conflict (job_id) do update
    set status = excluded.status,
        progress = excluded.progress,
        error_code = excluded.error_code,
        result_asset_ids = excluded.result_asset_ids,
        updated_at = now();
  return new;
end $$;

create trigger jobs_sync_status_feed
  after insert or update of status, progress, error_code, result_asset_ids on public.jobs
  for each row execute function public.sync_job_status_feed();

-- ---------------------------------------------------------------------------
-- Credits (SPEC §11.7) — SECURITY DEFINER, service role only
-- ---------------------------------------------------------------------------
create or replace function public.available_credits(b public.credit_balances) returns int
language sql stable as $$
  select (case when b.trial_expires_at is null or b.trial_expires_at > now() then b.trial_available else 0 end)
       + (case when b.subscription_expires_at is null or b.subscription_expires_at > now() then b.subscription_available else 0 end)
       + b.purchased_available
       - b.reserved;
$$;

create or replace function public.reserve_credits(p_workspace uuid, p_job uuid, p_amount int) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  b public.credit_balances%rowtype;
begin
  if p_amount < 0 then raise exception 'amount must be >= 0'; end if;
  select * into b from public.credit_balances where workspace_id = p_workspace for update;
  if not found then raise exception 'credit_balances row missing for workspace %', p_workspace; end if;
  if public.available_credits(b) < p_amount then
    return false;
  end if;
  update public.credit_balances set reserved = reserved + p_amount where workspace_id = p_workspace;
  update public.jobs set credits_reserved = p_amount where id = p_job;
  insert into public.credit_ledger (workspace_id, kind, delta, job_id, description)
  values (p_workspace, 'reservation', -p_amount, p_job, 'Reserved for job');
  return true;
end $$;

create or replace function public.release_reservation(p_job uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  j public.jobs%rowtype;
begin
  select * into j from public.jobs where id = p_job for update;
  if not found or j.credits_reserved <= 0 then return; end if;
  update public.credit_balances set reserved = greatest(0, reserved - j.credits_reserved) where workspace_id = j.workspace_id;
  insert into public.credit_ledger (workspace_id, kind, delta, job_id, description)
  values (j.workspace_id, 'release', j.credits_reserved, p_job, 'Reservation released');
  update public.jobs set credits_reserved = 0 where id = p_job;
end $$;

create or replace function public.settle_job_credits(p_job uuid, p_actual int) returns int
language plpgsql security definer set search_path = public as $$
declare
  j public.jobs%rowtype;
  b public.credit_balances%rowtype;
  remaining int;
  take int;
  charged int := 0;
begin
  select * into j from public.jobs where id = p_job for update;
  if not found then raise exception 'job % not found', p_job; end if;
  select * into b from public.credit_balances where workspace_id = j.workspace_id for update;
  if not found then raise exception 'credit_balances row missing'; end if;

  if j.credits_reserved > 0 then
    update public.credit_balances set reserved = greatest(0, reserved - j.credits_reserved) where workspace_id = j.workspace_id;
    insert into public.credit_ledger (workspace_id, kind, delta, job_id, description)
    values (j.workspace_id, 'release', j.credits_reserved, p_job, 'Reservation released');
  end if;

  remaining := greatest(0, coalesce(p_actual, 0));

  -- trial bucket first (expires soonest)
  if remaining > 0 and b.trial_available > 0 and (b.trial_expires_at is null or b.trial_expires_at > now()) then
    take := least(b.trial_available, remaining);
    update public.credit_balances set trial_available = trial_available - take where workspace_id = j.workspace_id;
    insert into public.credit_ledger (workspace_id, kind, bucket, delta, job_id, actor_id, description)
    values (j.workspace_id, 'settlement', 'trial', -take, p_job, j.user_id, 'Job charge');
    remaining := remaining - take; charged := charged + take;
  end if;

  -- subscription bucket (resets monthly)
  if remaining > 0 and b.subscription_available > 0 and (b.subscription_expires_at is null or b.subscription_expires_at > now()) then
    take := least(b.subscription_available, remaining);
    update public.credit_balances set subscription_available = subscription_available - take where workspace_id = j.workspace_id;
    insert into public.credit_ledger (workspace_id, kind, bucket, delta, job_id, actor_id, description)
    values (j.workspace_id, 'settlement', 'subscription', -take, p_job, j.user_id, 'Job charge');
    remaining := remaining - take; charged := charged + take;
  end if;

  -- purchased (usage credits) last
  if remaining > 0 and b.purchased_available > 0 then
    take := least(b.purchased_available, remaining);
    update public.credit_balances set purchased_available = purchased_available - take where workspace_id = j.workspace_id;
    insert into public.credit_ledger (workspace_id, kind, bucket, delta, job_id, actor_id, description)
    values (j.workspace_id, 'settlement', 'purchased', -take, p_job, j.user_id, 'Job charge');
    remaining := remaining - take; charged := charged + take;
  end if;

  update public.jobs set credits_reserved = 0, credits_charged = charged where id = p_job;
  return charged;
end $$;

create or replace function public.grant_credits(
  p_workspace uuid,
  p_bucket public.credit_bucket,
  p_amount int,
  p_kind public.ledger_kind,
  p_ref text default null,
  p_expires_at timestamptz default null,
  p_actor uuid default null,
  p_description text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_ref is not null and exists (select 1 from public.credit_ledger where stripe_event_id = p_ref and kind = p_kind) then
    return false; -- idempotent
  end if;
  perform 1 from public.credit_balances where workspace_id = p_workspace for update;
  if p_bucket = 'trial' then
    update public.credit_balances
      set trial_available = trial_available + p_amount,
          trial_expires_at = coalesce(p_expires_at, trial_expires_at)
      where workspace_id = p_workspace;
  elsif p_bucket = 'subscription' then
    update public.credit_balances
      set subscription_available = subscription_available + p_amount,
          subscription_expires_at = coalesce(p_expires_at, subscription_expires_at)
      where workspace_id = p_workspace;
  else
    update public.credit_balances
      set purchased_available = greatest(0, purchased_available + p_amount)
      where workspace_id = p_workspace;
  end if;
  insert into public.credit_ledger (workspace_id, kind, bucket, delta, stripe_event_id, actor_id, description)
  values (p_workspace, p_kind, p_bucket, p_amount, p_ref, p_actor, p_description);
  return true;
end $$;

create or replace function public.reset_subscription_credits(
  p_workspace uuid,
  p_amount int,
  p_expires_at timestamptz,
  p_ref text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  cur int;
begin
  if p_ref is not null and exists (select 1 from public.credit_ledger where stripe_event_id = p_ref and kind = 'subscription_grant') then
    return false;
  end if;
  select subscription_available into cur from public.credit_balances where workspace_id = p_workspace for update;
  if cur is null then raise exception 'credit_balances row missing'; end if;
  if cur > 0 then
    insert into public.credit_ledger (workspace_id, kind, bucket, delta, stripe_event_id, description)
    values (p_workspace, 'expiry', 'subscription', -cur, p_ref, 'Unused subscription credits expired at renewal');
  end if;
  update public.credit_balances
    set subscription_available = p_amount, subscription_expires_at = p_expires_at
    where workspace_id = p_workspace;
  insert into public.credit_ledger (workspace_id, kind, bucket, delta, stripe_event_id, description)
  values (p_workspace, 'subscription_grant', 'subscription', p_amount, p_ref, 'Monthly subscription credits');
  return true;
end $$;

create or replace function public.expire_credits(p_workspace uuid, p_bucket public.credit_bucket) returns int
language plpgsql security definer set search_path = public as $$
declare
  cur int := 0;
begin
  perform 1 from public.credit_balances where workspace_id = p_workspace for update;
  if p_bucket = 'trial' then
    select trial_available into cur from public.credit_balances where workspace_id = p_workspace;
    update public.credit_balances set trial_available = 0, trial_expires_at = null where workspace_id = p_workspace;
  elsif p_bucket = 'subscription' then
    select subscription_available into cur from public.credit_balances where workspace_id = p_workspace;
    update public.credit_balances set subscription_available = 0, subscription_expires_at = null where workspace_id = p_workspace;
  else
    return 0;
  end if;
  if coalesce(cur, 0) > 0 then
    insert into public.credit_ledger (workspace_id, kind, bucket, delta, description)
    values (p_workspace, 'expiry', p_bucket, -cur, 'Credits expired');
  end if;
  return coalesce(cur, 0);
end $$;

create or replace function public.set_subscription_expiry(p_workspace uuid, p_expires_at timestamptz) returns void
language sql security definer set search_path = public as $$
  update public.credit_balances set subscription_expires_at = p_expires_at where workspace_id = p_workspace;
$$;

create or replace function public.adjust_storage(p_workspace uuid, p_delta bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v bigint;
begin
  update public.workspaces
    set storage_used_bytes = greatest(0, storage_used_bytes + p_delta)
    where id = p_workspace
    returning storage_used_bytes into v;
  return v;
end $$;

-- Fixed-window rate limiter (SPEC §22); service role only
create or replace function public.increment_rate_limit(p_key text, p_window_seconds int, p_limit int) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  r public.rate_limits%rowtype;
begin
  insert into public.rate_limits (key, count, window_start) values (p_key, 1, now())
  on conflict (key) do update
    set count = case when public.rate_limits.window_start + make_interval(secs => p_window_seconds) < now() then 1 else public.rate_limits.count + 1 end,
        window_start = case when public.rate_limits.window_start + make_interval(secs => p_window_seconds) < now() then now() else public.rate_limits.window_start end
  returning * into r;
  return r.count <= p_limit;
end $$;

-- Monthly violation counter (SPEC §12.2); service role only
create or replace function public.record_violation(p_user uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v int;
begin
  update public.profiles
    set violations_month = case when violations_reset_at is null or violations_reset_at <= now() then 1 else violations_month + 1 end,
        violations_reset_at = case when violations_reset_at is null or violations_reset_at <= now()
                                   then date_trunc('month', now() at time zone 'utc') + interval '1 month'
                                   else violations_reset_at end
    where id = p_user
    returning violations_month into v;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Client RPC (security invoker)
-- ---------------------------------------------------------------------------
create or replace function public.my_workspaces()
returns table (
  id uuid, name text, slug text, type public.workspace_type, plan public.plan_tier,
  subscription_status public.subscription_status, owner_id uuid, role public.member_role,
  storage_used_bytes bigint, storage_quota_bytes bigint, current_period_end timestamptz,
  cancel_at_period_end boolean, grace_until timestamptz
)
language sql stable security invoker set search_path = public as $$
  select w.id, w.name, w.slug, w.type, w.plan, w.subscription_status, w.owner_id, m.role,
         w.storage_used_bytes, w.storage_quota_bytes, w.current_period_end, w.cancel_at_period_end, w.grace_until
  from public.workspaces w
  join public.workspace_members m on m.workspace_id = w.id
  where m.user_id = auth.uid()
  order by (w.type = 'personal') desc, w.created_at;
$$;

create or replace function public.workspace_balance(p_workspace uuid)
returns table (
  trial_available int, trial_expires_at timestamptz,
  subscription_available int, subscription_expires_at timestamptz,
  purchased_available int, reserved int, available int
)
language sql stable security invoker set search_path = public as $$
  select b.trial_available, b.trial_expires_at, b.subscription_available, b.subscription_expires_at,
         b.purchased_available, b.reserved, public.available_credits(b)
  from public.credit_balances b
  where b.workspace_id = p_workspace and public.is_member(p_workspace);
$$;

-- ---------------------------------------------------------------------------
-- Privileges: privileged RPCs only for service_role
-- ---------------------------------------------------------------------------
revoke execute on function public.reserve_credits(uuid, uuid, int) from public, anon, authenticated;
revoke execute on function public.release_reservation(uuid) from public, anon, authenticated;
revoke execute on function public.settle_job_credits(uuid, int) from public, anon, authenticated;
revoke execute on function public.grant_credits(uuid, public.credit_bucket, int, public.ledger_kind, text, timestamptz, uuid, text) from public, anon, authenticated;
revoke execute on function public.reset_subscription_credits(uuid, int, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.expire_credits(uuid, public.credit_bucket) from public, anon, authenticated;
revoke execute on function public.set_subscription_expiry(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.adjust_storage(uuid, bigint) from public, anon, authenticated;
revoke execute on function public.increment_rate_limit(text, int, int) from public, anon, authenticated;
revoke execute on function public.record_violation(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;
revoke execute on function public.sync_job_status_feed() from public, anon, authenticated;
