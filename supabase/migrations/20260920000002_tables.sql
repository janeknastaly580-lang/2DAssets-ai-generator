-- Veyraflow — tables (SPEC §15.1)

-- profiles: 1:1 with auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  display_name text,
  avatar_key text,
  role public.user_role not null default 'user',
  tos_accepted_at timestamptz,
  tos_version text,
  marketing_consent boolean not null default false,
  notification_prefs jsonb not null default '{"job_completed": false, "assets_expiring": true}'::jsonb,
  cookie_consent jsonb,
  trial_used_at timestamptz,
  violations_month int not null default 0,
  violations_reset_at timestamptz,
  banned_at timestamptz,
  ban_reason text,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.auth_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email citext not null,
  purpose public.auth_code_purpose not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  max_attempts int not null default 5,
  consumed_at timestamptz,
  ip inet,
  created_at timestamptz not null default now()
);
create index auth_codes_email_purpose_idx on public.auth_codes (email, purpose, created_at desc);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  type public.workspace_type not null,
  owner_id uuid not null references public.profiles(id),
  plan public.plan_tier not null default 'none',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status public.subscription_status not null default 'none',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  seats int not null default 1,
  storage_used_bytes bigint not null default 0,
  storage_quota_bytes bigint not null default 536870912, -- 0.5 GB
  retention_days int,        -- null = unlimited while plan active
  grace_until timestamptz,   -- end of grace period after plan ends
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role public.member_role not null,
  invited_by uuid references public.profiles(id),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id);

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email citext not null,
  role public.member_role not null default 'member',
  token_hash text not null unique,
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.credit_balances (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  trial_available int not null default 0,
  trial_expires_at timestamptz,
  subscription_available int not null default 0,
  subscription_expires_at timestamptz,
  purchased_available int not null default 0,
  reserved int not null default 0,
  updated_at timestamptz not null default now(),
  check (trial_available >= 0 and subscription_available >= 0 and purchased_available >= 0 and reserved >= 0)
);

create table public.credit_ledger (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind public.ledger_kind not null,
  bucket public.credit_bucket,
  delta int not null,
  job_id uuid,
  stripe_event_id text,
  actor_id uuid references public.profiles(id) on delete set null,
  description text,
  created_at timestamptz not null default now()
);
create index credit_ledger_ws_idx on public.credit_ledger (workspace_id, created_at desc);
create index credit_ledger_stripe_idx on public.credit_ledger (stripe_event_id) where stripe_event_id is not null;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  style_guide jsonb not null default '{}'::jsonb,
  is_scratch boolean not null default false,
  cover_asset_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table public.project_references (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind public.reference_kind not null,
  label text,
  r2_key text not null,
  asset_id uuid,
  extracted_palette jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index project_references_project_idx on public.project_references (project_id);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  user_id uuid not null references public.profiles(id),
  type public.asset_type not null,
  status public.job_status not null default 'queued',
  progress int not null default 0,
  input jsonb not null,
  translated_prompt jsonb,
  translator_model text,
  translator_prompt_version text,
  moderation_model text,
  moderation_prompt_version text,
  provider text,
  provider_model text,
  provider_job_id text,
  provider_cost_usd numeric(10,4),
  credits_estimated int not null,
  credits_reserved int not null default 0,
  credits_charged int,
  error_code text,
  error_message text,
  inngest_run_id text,
  result_asset_ids uuid[] not null default '{}',
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_ws_created_idx on public.jobs (workspace_id, created_at desc);
create index jobs_active_idx on public.jobs (status) where status not in ('completed','failed','rejected','cancelled');
create index jobs_provider_job_idx on public.jobs (provider_job_id) where provider_job_id is not null;

-- Narrow, realtime-safe projection of jobs (SPEC §15.3)
create table public.job_status_feed (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  workspace_id uuid not null,
  user_id uuid not null,
  type public.asset_type not null,
  status public.job_status not null,
  progress int not null default 0,
  error_code text,
  result_asset_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);
create index job_status_feed_ws_idx on public.job_status_feed (workspace_id, updated_at desc);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  type public.asset_type not null,
  name text not null,
  slug text not null,
  status public.asset_status not null default 'processing',
  source_job_id uuid references public.jobs(id) on delete set null,
  parent_asset_id uuid references public.assets(id) on delete set null,
  prompt text,
  metadata jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  preview_key text,
  animated_preview_key text,
  size_bytes bigint not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assets_ws_proj_idx on public.assets (workspace_id, project_id, created_at desc) where deleted_at is null;
create index assets_expires_idx on public.assets (expires_at) where deleted_at is null;
create index assets_deleted_idx on public.assets (workspace_id, deleted_at) where deleted_at is not null;

alter table public.projects
  add constraint projects_cover_asset_fk foreign key (cover_asset_id) references public.assets(id) on delete set null;

create table public.asset_files (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  format text not null,
  variant text,
  engine_preset text,
  r2_key text not null,
  size_bytes bigint not null,
  checksum_sha256 text,
  created_at timestamptz not null default now()
);
create index asset_files_asset_idx on public.asset_files (asset_id);

create table public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  source text not null,
  verdict public.moderation_verdict not null,
  category text,
  reason text,
  prompt_excerpt text,
  model text,
  created_at timestamptz not null default now()
);
create index moderation_events_user_idx on public.moderation_events (user_id, created_at desc);

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  target_type public.share_target not null,
  target_id uuid not null,
  token_hash text not null unique,
  allow_download boolean not null default false,
  show_prompt boolean not null default false,
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count int not null default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index share_links_target_idx on public.share_links (target_type, target_id);

create table public.model_pricing (
  id text primary key,
  pipeline public.asset_type not null,
  provider text not null,
  provider_model text not null,
  credits int not null,
  est_provider_cost_usd numeric(10,4) not null,
  enabled boolean not null default true,
  params jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz,
  payload jsonb not null,
  error text,
  received_at timestamptz not null default now()
);

create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  r2_key text not null,
  mime text not null,
  size_bytes bigint not null,
  completed boolean not null default false,
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now()
);

create table public.downloads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  spec jsonb not null,
  status text not null default 'queued',
  r2_key text,
  size_bytes bigint,
  error text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index downloads_ws_idx on public.downloads (workspace_id, created_at desc);

create table public.voice_cache (
  voice_id text primary key,
  name text not null,
  labels jsonb,
  preview_url text,
  category text,
  updated_at timestamptz not null default now()
);

create table public.rate_limits (
  key text primary key,
  count int not null default 0,
  window_start timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  payload jsonb,
  ip inet,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
