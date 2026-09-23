-- Veyraflow — FK cascades required for account deletion (SPEC §21.5)
alter table public.workspaces drop constraint workspaces_owner_id_fkey;
alter table public.workspaces add constraint workspaces_owner_id_fkey
  foreign key (owner_id) references public.profiles(id) on delete cascade;

alter table public.workspace_members drop constraint workspace_members_invited_by_fkey;
alter table public.workspace_members add constraint workspace_members_invited_by_fkey
  foreign key (invited_by) references public.profiles(id) on delete set null;

alter table public.workspace_invites drop constraint workspace_invites_invited_by_fkey;
alter table public.workspace_invites add constraint workspace_invites_invited_by_fkey
  foreign key (invited_by) references public.profiles(id) on delete cascade;

alter table public.jobs drop constraint jobs_user_id_fkey;
alter table public.jobs add constraint jobs_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.share_links drop constraint share_links_created_by_fkey;
alter table public.share_links add constraint share_links_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete cascade;
