-- Veyraflow — 2026-09-22 product changes (SPEC §9.0, §9.3, §9.4, §9.6, §21.5).
--
-- 1. The Image and Sprite-animation generators were removed from the product.
--    The `asset_type` enum KEEPS the `image` and `sprite_animation` values on purpose: existing
--    rows in `jobs` / `assets` / `model_pricing.pipeline` reference them, and Postgres cannot drop
--    an enum value that is still part of a column type. The application no longer accepts them
--    (lib/validation/jobs.ts ASSET_TYPES) and `runGenerationJob` fails such a job with
--    `pipeline_removed`.
-- 2. 3D gained an Engine selector (Rodin Gen-2.5 / TRELLIS) that replaces the Category field and
--    now drives the base price.
-- 3. The TTS voice catalogue was removed, so `voice_cache` is no longer needed.

-- --- 1. retire the Image / Sprite-animation pricing and flags -----------------
delete from public.model_pricing where id like 'image.%' or id like 'sprite.%';
delete from public.feature_flags where key in ('pipeline.image.enabled', 'pipeline.sprite_animation.enabled');

-- --- 2. 3D engines -----------------------------------------------------------
-- Replaces model3d.fast / model3d.standard / model3d.image. `provider = 'unbound'` marks an
-- engine that is selectable in the UI and priced, but not yet wired to a real provider.
insert into public.model_pricing (id, pipeline, provider, provider_model, credits, est_provider_cost_usd, enabled, params) values
  ('model3d.engine.rodin',   'model_3d', 'unbound', 'rodin-gen-2.5',     45, 0.4000, true,
   '{"description":"Rodin Gen-2.5 - higher quality, higher credit usage. Provider not wired yet."}'::jsonb),
  ('model3d.engine.trellis', 'model_3d', 'unbound', 'microsoft-trellis', 25, 0.2000, true,
   '{"description":"TRELLIS (Microsoft) - lower credit usage. Provider not wired yet."}'::jsonb)
on conflict (id) do update set
  pipeline = excluded.pipeline,
  provider = excluded.provider,
  provider_model = excluded.provider_model,
  credits = excluded.credits,
  est_provider_cost_usd = excluded.est_provider_cost_usd,
  params = excluded.params;

delete from public.model_pricing where id in ('model3d.fast', 'model3d.standard', 'model3d.image');

-- --- 3. drop the TTS voice catalogue ------------------------------------------
drop table if exists public.voice_cache;

-- --- 4. account deletion is immediate (SPEC §21.5) ---------------------------
-- The 14-day grace period was dropped: the user confirms by typing the e-mail they are signed in
-- with and `POST /api/account {action:"delete_account"}` destroys the account in that request.
-- `profiles.deletion_requested_at` and the `retention-cleanup` sweep that read it are gone.
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
      or new.created_at is distinct from old.created_at
    then
      raise exception 'You may only change display_name, avatar_key, marketing_consent, notification_prefs and cookie_consent';
    end if;
  end if;
  return new;
end $$;

alter table public.profiles drop column if exists deletion_requested_at;
