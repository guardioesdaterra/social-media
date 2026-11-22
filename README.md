# Social Media · Earth Guardians Editorial Calendar

A friendly, static editorial calendar for the `@earthguardians` Instagram presence — built so staff can plan posts, newsletters, and website updates in one place, and so anyone in the community can see how it works under the hood.

## Who this is for

| You | What you'll find here |
|-----|----------------------|
| **Earth Guardians staff** | The editorial panel: log in with your `@earthguardians.org` Google account, plan Instagram posts, schedule newsletters, and publish website updates. |
| **Donors & supporters** | A transparent look at how the calendar is built and run — no hidden magic, just open source code you can read and reuse. |
| **Open-source contributors** | A small, well-typed Nuxt 3 + Supabase project with clear conventions, ready for pull requests. |

## What it does, in plain language

The panel is a private calendar where Earth Guardians staff can:

- **Plan Instagram posts** — pick a day, choose a topic (e.g. Climate Action, Fundraising), add a title/caption/hashtags, upload an image, and set a status (planned → in production → approved → published). Multiple posts can live on the same day.
- **See a real calendar** — month view, week view, and list view with today highlighted, previous/next month days shown, and year/month pickers.
- **Reorder content** — drag posts between days, reorder them within a day, and maintain a ranked "Topics needing attention" list (#1, #2, …).
- **Send newsletters** — draft, schedule, and track email newsletters with subject, HTML body, and recipient list.
- **Update the website** — create, publish, or archive site page updates with title, slug, HTML content, and publish date.
- **See changes live** — open the panel in two browser tabs and edits appear instantly in both, thanks to Supabase Realtime.

Everything a staff member saves goes through the backend (Supabase Edge Functions) and is stored in a Postgres database. Images are stored as base64 directly in Postgres (no separate S3 bucket), capped at 4 MiB each.

## Under the hood — how it works

### The stack

- **Nuxt 3** — the frontend framework. It builds to a static site (SSG) that's hosted on GitHub Pages. After the static shell loads, everything runs in your browser.
- **Vue 3 + Tailwind CSS** — the UI layer. Styled with Tailwind; no component library dependency.
- **Supabase** — the backend: Postgres database, Auth (Google login), Edge Functions (server logic), and Realtime (live sync across tabs).
- **TypeScript** — types everywhere, so the code is self-documenting and safer to change.

### Where data lives

All content lives in Supabase Postgres tables:

- `calendar_topics` — campaign topics with a color, emoji, and sort order.
- `calendar_posts` — one row per Instagram post. `day` (`YYYY-MM-DD`), `topic_key` (required), format, title, caption, hashtags, status, image, and sort order within the day.
- `calendar_settings` — app-wide settings plus a monotonic `version` counter used to keep open tabs in sync.
- `newsletters` — email drafts with status (draft/scheduled/sent).
- `site_updates` — website page updates with status (draft/published/archived) plus optional Wayback Machine snapshot tracking.

### How a save happens (the write path)

1. Your browser sends the change to a Supabase **Edge Function** (`calendar-save`, `newsletter-save`, or `site-update-save`).
2. The function checks your Google session token and confirms your email ends in `@earthguardians.org` (the manager gate).
3. If you're cleared, the function validates the payload (dates, image size, text lengths, topic existence) and writes to Postgres using a service-role key — the browser never touches the database directly.
4. The function bumps a `version` counter and returns the saved row.
5. Supabase Realtime broadcasts the change to every other open tab, so they update instantly.

### How reading works

Each content type has a matching "get" edge function (`calendar-get`, `newsletter-get`, `site-update-get`). The frontend loads a full snapshot once on boot, then keeps it fresh via Realtime. Reads are served by the Supabase anon key with Row Level Security (RLS) — authenticated `@earthguardians.org` accounts can read; everything else is blocked.

### Authentication & access control

- You sign in with Google through Supabase Auth.
- The `is-manager` edge function checks whether your Google account email ends in `@earthguardians.org`.
- Only managers can open the panel or save changes. Everyone else sees a "access restricted" screen.
- In development you can run `pnpm dev:mock` to use a fake manager account without Google or Supabase.

### Calendar math (no date library)

`lib/calendar.ts` is a small, pure, testable module that handles months, days-per-month, leap years, weekday offsets, and week grids — with no `date-fns` or similar dependency. Weeks start on Sunday.

### Images

Images are converted to base64 data URLs in the browser (`lib/image.ts`) without recompression (full quality), size-checked against the 4 MiB limit, and stored in Postgres. Downloads reconstruct the original file from the data URL.

### Deployment

- Frontend: static build (`pnpm generate`) → GitHub Pages at `https://guardioesdaterra.github.io/social-media/`.
- Backend: `node scripts/deploy-supabase.mjs` pushes migrations and deploys the Edge Functions to the Supabase project.

## Quick start for staff

```bash
# 1. Install dependencies
pnpm install

# 2. Copy the env example and fill in your Supabase keys
cp .env.example .env
# Edit .env: NUXT_PUBLIC_SUPABASE_URL and NUXT_PUBLIC_SUPABASE_KEY

# 3. Run locally (mock mode — no Google/Supabase needed)
pnpm dev:mock   # http://localhost:3000

# 4. Or run with real Supabase
pnpm dev        # http://localhost:3000, then sign in with Google
```

Log in with any `@earthguardians.org` Google account to open the editorial panel.

## One-time Supabase setup

```bash
npx supabase login
npx supabase link --project-ref eghddkeceomhwkaefqrq
node scripts/deploy-supabase.mjs   # pushes migrations + deploys edge functions
```

Then in the Supabase dashboard:
1. **Auth → Providers → Google**: enable Google and add your OAuth client ID/secret. Authorized redirect URI: `https://guardioesdaterra.github.io/social-media/auth/callback`.
2. **Edge Functions → Secrets**: confirm `SUPABASE_URL` and `SERVICE_ROLE_KEY` are set (injected automatically by Supabase).
3. **Authentication → URL Configuration**: add Site URL `https://guardioesdaterra.github.io/social-media/`.

## Deploy to GitHub Pages

```bash
# Add repo secrets in GitHub (Settings → Secrets and variables → Actions):
# NUXT_PUBLIC_SUPABASE_URL = https://eghddkeceomhwkaefqrq.supabase.co
# NUXT_PUBLIC_SUPABASE_KEY   = your Supabase anon (public) key

# Push to master — the workflow builds and deploys automatically
git push origin master

# Then enable Pages in repo Settings → Pages (source: GitHub Actions)
# URL: https://guardioesdaterra.github.io/social-media/
```

## Available commands

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start local dev server with real Supabase |
| `pnpm dev:mock` | Start local dev with fake data (no login needed) |
| `pnpm generate` | Build static site for GitHub Pages |
| `pnpm preview` | Preview the static build locally |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm lint` | Run ESLint |
| `pnpm lint:fix` | Auto-fix lint issues |
| `pnpm supabase:deploy` | Push migrations + deploy Edge Functions |

## Project structure (top level)

```
supabase/            # Backend: migrations + Edge Functions
  migrations/        # SQL schema (posts, topics, newsletters, site updates, RLS, realtime)
  functions/         # Deno edge functions: is-manager, calendar-get/save, newsletter-get/save,
                     # site-update-get/save, wayback-capture, and shared auth/CORS helpers
lib/                 # Shared frontend code: supabase client, types, calendar math, image utils, mock
composables/         # Vue composables: auth, calendar, newsletters, site updates, toast, wayback
components/          # Vue components: calendar views, editors, panels, auth gate
pages/               # Nuxt pages: login, calendar, newsletters, site updates
scripts/             # deploy-supabase.mjs, make-seed.mjs
.github/workflows/   # GitHub Actions: deploy to GitHub Pages
```

## Contributing

This is open source and maintained for Earth Guardians. To contribute:

1. Fork the repo and create a branch from `master`.
2. Make your change, then run `pnpm typecheck` and `pnpm lint` to keep the code clean.
3. Open a pull request describing what changed and why.

If you're adding a new feature, prefer small, focused PRs and update this README if user-facing behavior changes.

## License & contact

Open source for the Earth Guardians community. Questions or ideas? Open an issue in this repo or reach out to the Earth Guardians digital team.
