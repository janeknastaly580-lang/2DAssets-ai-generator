-- Veyraflow — extensions and enums (SPEC §15.1)
create extension if not exists "pgcrypto";
create extension if not exists "citext" with schema extensions;

create type public.user_role as enum ('user','admin');
create type public.workspace_type as enum ('personal','team');
create type public.plan_tier as enum ('none','trial','pro','studio');
create type public.subscription_status as enum ('none','active','past_due','canceled','unpaid','incomplete');
create type public.member_role as enum ('owner','admin','member','viewer');
create type public.auth_code_purpose as enum ('signup','password_reset');
create type public.asset_type as enum ('image','sprite_animation','model_3d','audio_sfx','audio_music','audio_voice');
create type public.asset_status as enum ('processing','ready','failed');
create type public.job_status as enum ('queued','moderating','translating','generating','post_processing','uploading','completed','failed','rejected','cancelled');
create type public.credit_bucket as enum ('trial','subscription','purchased');
create type public.ledger_kind as enum ('subscription_grant','pack_purchase','trial_purchase','reservation','settlement','release','refund','admin_adjustment','expiry');
create type public.reference_kind as enum ('style','character','palette');
create type public.share_target as enum ('asset','project');
create type public.moderation_verdict as enum ('allow','block');
