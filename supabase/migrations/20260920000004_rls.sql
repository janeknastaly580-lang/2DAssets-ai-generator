-- Veyraflow — Row Level Security (SPEC §15.3)

alter table public.profiles enable row level security;
alter table public.auth_codes enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.credit_balances enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.projects enable row level security;
alter table public.project_references enable row level security;
alter table public.jobs enable row level security;
alter table public.job_status_feed enable row level security;
alter table public.assets enable row level security;
alter table public.asset_files enable row level security;
alter table public.moderation_events enable row level security;
alter table public.share_links enable row level security;
alter table public.model_pricing enable row level security;
alter table public.feature_flags enable row level security;
alter table public.stripe_events enable row level security;
alter table public.uploads enable row level security;
alter table public.downloads enable row level security;
alter table public.voice_cache enable row level security;
alter table public.rate_limits enable row level security;
alter table public.audit_log enable row level security;

-- profiles ------------------------------------------------------------------
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- members of a shared workspace may see basic profile rows of other members
create policy "profiles: read co-members" on public.profiles
  for select to authenticated using (
    exists (
      select 1 from public.workspace_members a
      join public.workspace_members b on a.workspace_id = b.workspace_id
      where a.user_id = auth.uid() and b.user_id = profiles.id
    )
  );

-- workspaces ---------------------------------------------------------------
create policy "workspaces: member read" on public.workspaces
  for select to authenticated using (public.is_member(id) or public.is_admin());
create policy "workspaces: owner update name" on public.workspaces
  for update to authenticated using (public.is_member(id, 'owner')) with check (public.is_member(id, 'owner'));

create policy "workspace_members: member read" on public.workspace_members
  for select to authenticated using (public.is_member(workspace_id) or public.is_admin());

create policy "workspace_invites: admin read" on public.workspace_invites
  for select to authenticated using (public.is_member(workspace_id, 'admin'));

-- credits ------------------------------------------------------------------
create policy "credit_balances: member read" on public.credit_balances
  for select to authenticated using (public.is_member(workspace_id) or public.is_admin());
create policy "credit_ledger: member read" on public.credit_ledger
  for select to authenticated using (public.is_member(workspace_id) or public.is_admin());

-- projects -----------------------------------------------------------------
create policy "projects: member read" on public.projects
  for select to authenticated using (public.is_member(workspace_id) or public.is_admin());
create policy "projects: member insert" on public.projects
  for insert to authenticated with check (public.is_member(workspace_id, 'member'));
create policy "projects: member update" on public.projects
  for update to authenticated using (public.is_member(workspace_id, 'member')) with check (public.is_member(workspace_id, 'member'));
create policy "projects: admin delete" on public.projects
  for delete to authenticated using (public.is_member(workspace_id, 'admin') or (public.is_member(workspace_id, 'member') and created_by = auth.uid()));

create policy "project_references: member read" on public.project_references
  for select to authenticated using (exists (select 1 from public.projects p where p.id = project_id and public.is_member(p.workspace_id)));
create policy "project_references: member insert" on public.project_references
  for insert to authenticated with check (exists (select 1 from public.projects p where p.id = project_id and public.is_member(p.workspace_id, 'member')));
create policy "project_references: member delete" on public.project_references
  for delete to authenticated using (exists (select 1 from public.projects p where p.id = project_id and public.is_member(p.workspace_id, 'member')));

-- jobs (column-level: translated_prompt / provider_* hidden from clients) ---
create policy "jobs: member read" on public.jobs
  for select to authenticated using (public.is_member(workspace_id) or public.is_admin());
revoke select on public.jobs from anon, authenticated;
grant select (id, workspace_id, project_id, user_id, type, status, progress, input, credits_estimated,
              credits_reserved, credits_charged, error_code, error_message, result_asset_ids,
              started_at, finished_at, created_at, updated_at)
  on public.jobs to authenticated;

create view public.jobs_public with (security_invoker = true) as
  select id, workspace_id, project_id, user_id, type, status, progress, input, credits_estimated,
         credits_reserved, credits_charged, error_code, error_message, result_asset_ids,
         started_at, finished_at, created_at, updated_at
  from public.jobs;
grant select on public.jobs_public to authenticated;

create policy "job_status_feed: member read" on public.job_status_feed
  for select to authenticated using (public.is_member(workspace_id));

-- assets -------------------------------------------------------------------
create policy "assets: member read" on public.assets
  for select to authenticated using (public.is_member(workspace_id) or public.is_admin());
create policy "assets: member update" on public.assets
  for update to authenticated using (public.is_member(workspace_id, 'member')) with check (public.is_member(workspace_id, 'member'));

create policy "asset_files: member read" on public.asset_files
  for select to authenticated using (exists (select 1 from public.assets a where a.id = asset_id and (public.is_member(a.workspace_id) or public.is_admin())));

-- share links / downloads --------------------------------------------------
create policy "share_links: member read" on public.share_links
  for select to authenticated using (public.is_member(workspace_id));
create policy "downloads: member read" on public.downloads
  for select to authenticated using (public.is_member(workspace_id));

-- config tables readable by all signed-in users -----------------------------
create policy "model_pricing: authenticated read" on public.model_pricing
  for select to authenticated using (true);
create policy "feature_flags: authenticated read" on public.feature_flags
  for select to authenticated using (true);
create policy "voice_cache: authenticated read" on public.voice_cache
  for select to authenticated using (true);

-- moderation_events / audit_log: admin read only ---------------------------
create policy "moderation_events: admin read" on public.moderation_events
  for select to authenticated using (public.is_admin());
create policy "audit_log: admin read" on public.audit_log
  for select to authenticated using (public.is_admin());

-- auth_codes, stripe_events, rate_limits, uploads: no client policies (service role only)
