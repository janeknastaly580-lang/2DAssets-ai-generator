-- Veyraflow — queue moved from Inngest to Upstash Workflow (SPEC §14.1)
-- workflow_run_id: Upstash run id (`wfr_…`) of the generate-asset workflow, for support/debugging.
alter table public.jobs rename column inngest_run_id to workflow_run_id;

-- provider_calls: checkpoint of every provider request made by the pipeline, keyed "<n>:<model>",
-- value { provider, model, id, submitted_at, done?, result? }. Lets a pipeline chunk that yields
-- before Vercel's 300 s limit resume polling instead of resubmitting (and paying twice).
-- Cleared when the job finishes. Not granted to `authenticated` (column-level grants, 0004_rls).
alter table public.jobs add column provider_calls jsonb not null default '{}'::jsonb;
