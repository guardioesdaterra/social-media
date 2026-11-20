# Social Media · Earth Guardians Editorial Calendar

Nuxt 3 SSG + Supabase editorial calendar panel for `@earthguardians` Instagram posts.

## Stack
- Nuxt 3 (SSG/static, GitHub Pages)
- Vue 3 + VueUse (`useWindowSize`, `useToast`)
- Tailwind CSS
- Supabase: Edge Functions (`is-manager`, `calendar-get`, `calendar-save`), Realtime, RLS
- Images: base64 stored in Postgres (no S3)

## Project structure
```
supabase/
  config.toml                # project ref + auth (Google) config
  migrations/
    20261120000001_social_calendar.sql   # topics, posts, settings, RLS, realtime
    20261120000002_seed_calendar_2026_12.sql   # Dec 2026 plan (31 posts, 10 topics)
  functions/
    _shared/auth.ts, cors.ts
    is-manager/index.ts      # gate: only @earthguardians.org
    calendar-get/index.ts    # full snapshot read
    calendar-save/index.ts   # all writes (upsert/delete/reorder/attention)
scripts/
  deploy-supabase.mjs        # db push + functions deploy
  make-seed.mjs              # regenerates the Dec 2026 seed SQL
.github/workflows/deploy.yml # GitHub Pages deploy
```

## Data model
- `calendar_topics` — topic key, label, color, emoji, sort, `needs_attention` + `attention_rank` (#1, #2, … priority list).
- `calendar_posts` — one row per post; **multiple posts per day allowed** (`day`, `sort_order`). `year`/`month`/`dow` are generated from `day`. `topic_key` is **required** (every post linked to a topic). `image_base64` stores the image in Postgres (capped 4 MiB).
- `calendar_settings` — version counter + app settings.
- RLS: reads only for authenticated `@earthguardians.org` emails; all writes go through `calendar-save` (service role) after the manager gate.
- Realtime: `calendar_posts` and `calendar_topics` added to `supabase_realtime` — every open tab syncs live.

## Local development
```bash
pnpm install
cp .env.example .env   # fill in NUXT_PUBLIC_SUPABASE_URL / KEY
pnpm dev               # http://localhost:3000
pnpm generate          # static build (SSG) for GitHub Pages
pnpm typecheck
pnpm lint
```

## Supabase setup (one time)
```bash
npx supabase login                      # browser auth (already done)
npx supabase link --project-ref eghddkeceomhwkaefqrq
node scripts/deploy-supabase.mjs        # db push + deploy edge functions
```
Then in the Supabase dashboard:
1. **Auth → Providers → Google**: enable Google, add your Google Cloud OAuth client ID/secret.
   - Authorized redirect URI: `https://guardioesdaterra.github.io/social-media/auth/callback`
   - (Local dev: `http://localhost:3000/auth/callback`)
2. **Edge Functions → Secrets**: `SUPABASE_URL` and `SERVICE_ROLE_KEY` are injected automatically.
3. **Authentication → URL Configuration**: add Site URL `https://guardioesdaterra.github.io/social-media/` and the redirect URLs above.

Only accounts ending in `@earthguardians.org` pass the `is-manager` gate and can open the panel.

## GitHub Pages deploy
1. Create the repo: `gh repo create guardioesdaterra/social-media --public`
2. Add repo **Secrets and variables → Actions**:
   - `NUXT_PUBLIC_SUPABASE_URL` = `https://eghddkeceomhwkaefqrq.supabase.co`
   - `NUXT_PUBLIC_SUPABASE_KEY` = your Supabase **anon** (public) key
3. Push to `master`. The workflow builds (`pnpm generate` with `NUXT_APP_BASE_URL=/social-media/`) and deploys to GitHub Pages.
4. Enable Pages in repo **Settings → Pages** (source: GitHub Actions).
5. URL: `https://guardioesdaterra.github.io/social-media/`

## Features
- True calendar view: real months/years, days-per-month, adjacent-month days, today highlight, year/month pickers.
- Multiple posts per day, each linked to a topic.
- Week view: rearrange posts between days (move ←/→) and reorder within a day.
- "Topics needing attention": ordered priority list (#1, #2, …) with up/down/remove.
- Full-quality image upload/download (base64 in Postgres, no S3).
- Realtime sync across open browsers.
- Manager gate via Google OAuth + `@earthguardians.org` domain check.
