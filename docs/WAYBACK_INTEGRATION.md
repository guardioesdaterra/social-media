# Wayback Machine Integration

This document describes the Wayback Machine integration for tracking and comparing website changes over time.

## CORS fix — server-side proxy

`web.archive.org` does **not** send `Access-Control-Allow-Origin`, so browsers block direct `fetch` from GitHub Pages (`guardioesdaterra.github.io`). All archive.org calls are now proxied through the `wayback-cdx` Supabase edge function, which runs server-side and returns CORS-safe JSON.

### Edge function: `wayback-cdx`

`supabase/functions/wayback-cdx/index.ts`

```
GET /functions/v1/wayback-cdx?op=cdx&url=...&limit=50&from=...&to=...
GET /functions/v1/wayback-cdx?op=snapshot&url=...&timestamp=...
GET /functions/v1/wayback-cdx?op=available&url=...&timestamp=...
Auth: Bearer <access token of an @earthguardians.org account>
```

- `op=cdx` → proxies the CDX API, returns `{ snapshots, count }` (same shape the UI expects).
- `op=snapshot` → fetches raw archived HTML via the `id_` modifier (no archive toolbar), returns `{ content }`.
- `op=available` → proxies `/wayback/available`, returns `{ snapshot }`.

The function is manager-gated (same `requireManager` helper used by `wayback-capture` and other edge functions) and includes CORS headers for `guardioesdaterra.github.io` and `*.earthguardians.org`.

It is deployed alongside the other edge functions:

```js
// scripts/deploy-supabase.mjs
'wayback-capture',
'wayback-cdx',
```

Run: `pnpm supabase:deploy` (requires a linked Supabase project). No `WAYBACK_API_KEY` is needed for CDX reads — that key is only for Save Page Now captures (`wayback-capture`).

### Client: `composables/useWayback.ts`

`getSnapshots`, `getSnapshotContent` and `getNearestSnapshot` now call the `wayback-cdx` edge function (with the current session's bearer token) instead of fetching `web.archive.org` directly. In mock mode (`NUXT_PUBLIC_MOCK=1`) they return empty results without any network call.

`getReplayUrl` still builds a `web.archive.org/web/...` URL, but only for user-initiated navigation (links / `window.open` / iframe `src`), which does not trigger CORS.

### Setup required

1. Link the Supabase project: `npx supabase link --project-ref eghddkeceomhwkaefqrq`.
2. Deploy edge functions: `pnpm supabase:deploy` (now includes `wayback-cdx`).
3. Ensure managers sign in with an `@earthguardians.org` account so the bearer token passes the `requireManager` gate.

## Overview

The integration provides:
- **Snapshot Discovery**: Query the Wayback Machine CDX API for historical snapshots
- **Visual Comparison**: Side-by-side iframe diff viewer for comparing two versions
- **Text Diff**: Line-by-line text diff computed from extracted content
- **Audit Trail**: Store snapshots and diff data in the database for historical reference

## Components

### 1. `useWayback` Composable (`composables/useWayback.ts`)

Core API for interacting with the Wayback Machine:

```typescript
const wayback = useWayback()

// Query snapshots with digest collapsing (only unique content)
const snapshots = await wayback.getSnapshots('https://earthguardians.org/page', { 
  limit: 50 
})

// Get raw content without archive toolbar
const content = await wayback.getSnapshotContent('url', '20240101000000')

// Compute text diff between two versions
const diff = await wayback.getDiff('url', '20240101000000', '20240201000000')

// Get nearest snapshot to a date
const nearest = await wayback.getNearestSnapshot('url', '20240115')
```

### 2. `WaybackPicker` Component (`components/WaybackPicker.vue`)

UI for selecting snapshots to compare:
- URL input with validation
- Snapshot list with timestamps
- Checkbox selection (max 10)
- "Compare" button to launch diff viewer

### 3. `DiffViewer` Component (`components/DiffViewer.vue`)

Visual diff comparison:
- Side-by-side iframes showing both versions
- Navigation (prev/next) between snapshots
- Text diff summary (additions/deletions/unchanged)
- Expandable text diff details
- "View on Wayback" link for human viewing

## Database Schema

New columns added to `site_updates` table:

```sql
wayback_url TEXT          -- Original URL for Wayback snapshots
snapshot_timestamps JSONB -- Array of captured timestamps  
last_diff TEXT            -- JSON string of last diff comparison
```

## API Details

### CDX API (Snapshot Discovery)

Uses the Wayback Machine CDX server with:
- `collapse=digest` - Only return snapshots with unique content
- `filter=statuscode:200` - Only successful captures
- `fl=timestamp,original,statuscode,mimetype,digest` - Required fields

### id_ Modifier

When fetching content programmatically, use the `id_` modifier:
- Standard: `/web/{ts}/{url}` - Returns HTML with archive toolbar, rewritten links
- Raw: `/web/{ts}id_/{url}` - Returns original captured content

### Rate Limiting

- 600ms delay between requests
- User-Agent header: `EarthGuardians-Editorial-Calendar/1.0`
- Consider caching results

## GitHub Actions Workflow

The `wayback-snapshots.yml` workflow provides:

1. **Scheduled Runs**: Weekly execution to capture new snapshots
2. **Manual Triggers**: Can target specific URLs
3. **Save Page Now**: Uses the SPN2 API with:
   - `if_not_archived_within=7` - Skip if recent capture exists
   - `capture_all=1` - Capture error pages too

### Setup Required

1. Add `WAYBACK_API_KEY` secret to GitHub repo (S3-style: `access:secret`)
2. The workflow will then automatically:
   - Fetch tracked URLs from Supabase
   - Trigger new captures via Save Page Now API
   - Generate diff reports

## Usage Flow

1. **Create/Edit Site Update**: Enter URL in the Page URL field
2. **Switch to Snapshots Tab**: See available Wayback snapshots
3. **Select Versions**: Check 2+ snapshots to compare
4. **View Diff**: See side-by-side comparison with text diff
5. **Save**: Snapshot timestamps and last diff are stored

## Limitations

- **CORS**: Archive.org may block cross-origin requests from some domains
- **Iframe Embedding**: Not all archived pages can be embedded in iframes
- **Rate Limits**: CDX server may return 429 errors under heavy load
- **Content Extraction**: Scripts/styles may break text extraction accuracy

## Future Improvements

- Precompute diffs at build time (weekly GitHub Action)
- Store full diff JSON in separate table
- Add "auto-capture on save" trigger
- Support for video/image asset comparison
- Export diff reports as PDF