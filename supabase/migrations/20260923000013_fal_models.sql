-- Veyraflow — 2026-09-23: every generation model runs on fal.ai (SPEC §9.7, §11.2).
--
--   3D     Rodin Gen-2.5  fal-ai/hyper3d/rodin/v2.5/text-to-3d | fal-ai/hyper3d/rodin/v2.5 (image-to-3D)
--          TRELLIS        fal-ai/trellis (image-to-3D, one photo)
--   SFX    ElevenLabs Sound Effects v2   fal-ai/elevenlabs/sound-effects/v2
--   Music  Lyria 3 Pro                   fal-ai/lyria3/pro
--   Voice  ElevenLabs TTS Turbo v2.5     fal-ai/elevenlabs/tts/turbo-v2.5
--
-- Meshy, Stable Audio and the direct ElevenLabs API are gone. Credits are unchanged;
-- est_provider_cost_usd = fal list prices checked on 2026-09-23. The exact endpoint of a job
-- (e.g. Rodin text- vs image-to-3D) is resolved in code (lib/ai/falModels.ts) and stored in
-- jobs.provider_model; provider_model below documents the row.
-- Rig / animation add-ons stay `unbound`: their fal.ai model is not chosen yet, and the estimate
-- does not charge an unbound add-on.

insert into public.model_pricing (id, pipeline, provider, provider_model, credits, est_provider_cost_usd, enabled, params) values
  ('model3d.engine.rodin',    'model_3d',    'fal',     'fal-ai/hyper3d/rodin/v2.5',          45, 0.4000, true,
   '{"description":"Rodin Gen-2.5 on fal.ai: text-to-3D or image-to-3D (1-3 photos). $0.40 per generation."}'::jsonb),
  ('model3d.engine.trellis',  'model_3d',    'fal',     'fal-ai/trellis',                     25, 0.0200, true,
   '{"description":"TRELLIS on fal.ai: image-to-3D from exactly one photo. $0.02 per generation."}'::jsonb),
  ('model3d.high_addon',      'model_3d',    'fal',     'fal-ai/hyper3d/rodin/v2.5',          20, 0.0000, true,
   '{"description":"Rodin only: Quality High (hd_texture) and/or 4K textures (HighPack add-on, Studio plan). No separate fal list price."}'::jsonb),
  ('model3d.rig_addon',       'model_3d',    'unbound', 'fal-rigging-tbd',                    15, 0.1200, true,
   '{"description":"Auto-rig. The fal.ai rigging model is not chosen yet - not charged while unbound."}'::jsonb),
  ('model3d.animation_addon', 'model_3d',    'unbound', 'fal-animation-tbd',                  10, 0.0800, true,
   '{"description":"Per animation clip. The fal.ai animation model is not chosen yet - not charged while unbound."}'::jsonb),
  ('sfx.variant',             'audio_sfx',   'fal',     'fal-ai/elevenlabs/sound-effects/v2',  5, 0.0200, true,
   '{"description":"Per SFX variant ($0.002 per second, max 10 s)."}'::jsonb),
  ('music.lyria3.30s',        'audio_music', 'fal',     'fal-ai/lyria3/pro',                  35, 0.0800, true,
   '{"duration_s":30,"description":"Lyria 3 Pro, up to 30 s requested (15 s is billed as 30 s). $0.08 per track."}'::jsonb),
  ('music.lyria3.60s',        'audio_music', 'fal',     'fal-ai/lyria3/pro',                  60, 0.0800, true,
   '{"duration_s":60,"description":"Lyria 3 Pro, 60 s requested. $0.08 per track."}'::jsonb),
  ('music.lyria3.120s',       'audio_music', 'fal',     'fal-ai/lyria3/pro',                 110, 0.0800, true,
   '{"duration_s":120,"description":"Lyria 3 Pro, 120 s requested. $0.08 per track."}'::jsonb),
  ('music.lyria3.180s',       'audio_music', 'fal',     'fal-ai/lyria3/pro',                 150, 0.0800, true,
   '{"duration_s":180,"description":"Lyria 3 Pro, 180 s requested. $0.08 per track."}'::jsonb),
  ('voice.per_100_chars',     'audio_voice', 'fal',     'fal-ai/elevenlabs/tts/turbo-v2.5',    3, 0.0050, true,
   '{"description":"ElevenLabs TTS Turbo v2.5, per 100 characters, minimum 3 credits ($0.05 per 1000 characters)."}'::jsonb)
on conflict (id) do update set
  pipeline = excluded.pipeline,
  provider = excluded.provider,
  provider_model = excluded.provider_model,
  credits = excluded.credits,
  est_provider_cost_usd = excluded.est_provider_cost_usd,
  params = excluded.params;

-- Retired: ElevenLabs Music tiers, Stable Audio and the eleven_v3 voice tier.
delete from public.model_pricing
where id in ('music.eleven.30s', 'music.eleven.60s', 'music.eleven.120s', 'music.eleven.180s', 'music.standard', 'voice.expressive.per_100_chars');

-- The music flag no longer selects a provider.
update public.feature_flags set payload = '{}'::jsonb where key = 'pipeline.music.enabled';
