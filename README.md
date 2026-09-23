# Veyraflow

AI game-asset generator (2D sprites, 2D animations, 3D models, SFX, music, voices) with Unity / Unreal / Godot export presets.

**The single source of truth for this project is [`SPEC.md`](./SPEC.md)** — architecture, data model, external services, environment variables and the current deployment state (§0). This README is only the quick start.

## Quick start (localhost)

```bash
pnpm install
# .env.local already exists — paste SUPABASE_SERVICE_ROLE_KEY from Supabase → Project Settings → API Keys
pnpm dev            # http://localhost:3000
```

Then sign up at `/signup` (a 6-digit code is e-mailed via Resend), create a project and generate. All generation models run on fal.ai with `FAL_KEY` from `.env.local` (SPEC §9.7) — real calls cost money. Set `MOCK_PROVIDERS=true` in `.env` (or leave `FAL_KEY` empty) to work offline: generations then produce local placeholder files, but the whole flow (moderation → translation → credits → post-processing → library → download presets) is real.

To give yourself credits and admin rights locally, run in the Supabase SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
select public.grant_credits((select id from public.workspaces where owner_id = (select id from public.profiles where email = 'you@example.com') and type = 'personal'), 'purchased', 1000, 'admin_adjustment', null, null, null, 'dev credits');
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest unit tests |
| `pnpm lint` | ESLint |
| `pnpm check:public-env` | fails if a `NEXT_PUBLIC_*` var looks like a secret or the client bundle contains provider markers |
| `pnpm inngest:dev` | local Inngest dev server (set `INNGEST_DEV=1` to route events to it; otherwise jobs run inline) |
| `pnpm db:push` / `pnpm db:types` | Supabase CLI migrations / regenerate `lib/supabase/database.types.ts` |

## Layout

See SPEC §4.2. In short: `app/` (routes + API), `components/`, `lib/` (server logic: auth, credits, pipelines, storage, billing, AI adapters), `inngest/` (queue functions), `supabase/` (migrations + seed), `worker/` (Modal Python worker), `docs/legal/` (placeholder legal documents), `tests/`.
