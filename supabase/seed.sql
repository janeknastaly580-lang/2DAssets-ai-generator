-- Veyraflow — seed (SPEC §11.2 model_pricing, §19 feature_flags)
-- Admin user: after signing up, run
--   update public.profiles set role = 'admin' where email = 'you@example.com';

-- Current state after migrations 0012 (3D engines) and 0013 (all generation on fal.ai, SPEC §9.7).
insert into public.model_pricing (id, pipeline, provider, provider_model, credits, est_provider_cost_usd, enabled, params) values
  ('model3d.engine.rodin',    'model_3d',    'fal',     'fal-ai/hyper3d/rodin/v2.5',          45, 0.4000, true, '{"description":"Rodin Gen-2.5 on fal.ai: text-to-3D or image-to-3D (1-3 photos). $0.40 per generation."}'),
  ('model3d.engine.trellis',  'model_3d',    'fal',     'fal-ai/trellis',                     25, 0.0200, true, '{"description":"TRELLIS on fal.ai: image-to-3D from exactly one photo. $0.02 per generation."}'),
  ('model3d.high_addon',      'model_3d',    'fal',     'fal-ai/hyper3d/rodin/v2.5',          20, 0.0000, true, '{"description":"Rodin only: Quality High (hd_texture) and/or 4K textures (HighPack add-on, Studio plan). No separate fal list price."}'),
  ('model3d.rig_addon',       'model_3d',    'unbound', 'fal-rigging-tbd',                    15, 0.1200, true, '{"description":"Auto-rig. The fal.ai rigging model is not chosen yet - not charged while unbound."}'),
  ('model3d.animation_addon', 'model_3d',    'unbound', 'fal-animation-tbd',                  10, 0.0800, true, '{"description":"Per animation clip. The fal.ai animation model is not chosen yet - not charged while unbound."}'),
  ('sfx.variant',             'audio_sfx',   'fal',     'fal-ai/elevenlabs/sound-effects/v2',  5, 0.0200, true, '{"description":"Per SFX variant ($0.002 per second, max 10 s)."}'),
  ('music.lyria3.30s',        'audio_music', 'fal',     'fal-ai/lyria3/pro',                  35, 0.0800, true, '{"duration_s":30,"description":"Lyria 3 Pro, up to 30 s requested (15 s is billed as 30 s). $0.08 per track."}'),
  ('music.lyria3.60s',        'audio_music', 'fal',     'fal-ai/lyria3/pro',                  60, 0.0800, true, '{"duration_s":60,"description":"Lyria 3 Pro, 60 s requested. $0.08 per track."}'),
  ('music.lyria3.120s',       'audio_music', 'fal',     'fal-ai/lyria3/pro',                 110, 0.0800, true, '{"duration_s":120,"description":"Lyria 3 Pro, 120 s requested. $0.08 per track."}'),
  ('music.lyria3.180s',       'audio_music', 'fal',     'fal-ai/lyria3/pro',                 150, 0.0800, true, '{"duration_s":180,"description":"Lyria 3 Pro, 180 s requested. $0.08 per track."}'),
  ('voice.per_100_chars',     'audio_voice', 'fal',     'fal-ai/elevenlabs/tts/turbo-v2.5',    3, 0.0050, true, '{"description":"ElevenLabs TTS Turbo v2.5, per 100 characters, minimum 3 credits ($0.05 per 1000 characters)."}')
on conflict (id) do update set
  pipeline = excluded.pipeline, provider = excluded.provider, provider_model = excluded.provider_model,
  credits = excluded.credits, est_provider_cost_usd = excluded.est_provider_cost_usd, params = excluded.params;

insert into public.feature_flags (key, enabled, payload) values
  ('signup_enabled',                    true,  '{}'),
  ('maintenance_mode',                  false, '{"message":"Veyraflow is undergoing maintenance. Please try again shortly."}'),
  ('moderation_thresholds',             true,  '{"warn_at":3,"ban_at":12}'),
  ('pipeline.model3d.enabled',          true,  '{}'),
  ('pipeline.sfx.enabled',              true,  '{}'),
  ('pipeline.music.enabled',            true,  '{}'),
  ('pipeline.voice.enabled',            true,  '{}')
on conflict (key) do update set enabled = excluded.enabled, payload = excluded.payload;
