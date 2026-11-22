# Wayback Machine Integration

This document describes the Wayback Machine integration for tracking and comparing website changes over time.

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