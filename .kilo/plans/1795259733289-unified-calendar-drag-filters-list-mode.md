# Plan: Unified calendar with drag reorder, filters, list mode

**Path:** `/home/isa/social-media/.kilo/plans/1795259733289-unified-calendar-drag-filters-list-mode.md`

## Context

A client-side mock (`pnpm dev:mock`, `NUXT_PUBLIC_MOCK=1`) has been built so the app runs without Supabase. Posts, newsletters, and site updates were unified into `CalendarItem` types (`lib/types.ts`) and rendered with kind-based colors (`ITEM_KIND_COLORS`: post=grey, newsletter=blue, site_update=purple). A UTC clock + timezone menu was added to `AppHeader.vue`.

The typecheck still has pre-existing errors in `supabase/functions/*` edge functions (unrelated); new files typecheck cleanly except minor fixes being resolved.

## Goal

Make the calendar the single root view where all three item kinds appear, color-differentiated, with:
- Click-and-drag to reorder/reschedule events
- "Newsletters" and "Site updates" toolbar buttons acting as **filters** over the unified calendar (not separate pages)
- A **list mode** toggle alongside month/week views
- Drag within list mode to reorder items

## Affected files

- `pages/calendario.vue` — root calendar; add filter state + list mode + drag handlers
- `components/CalendarMonth.vue` — month view; add drag handles / drop targets on chips
- `components/CalendarWeek.vue` — week view; add drag handles / drop targets on items
- `components/DayPanel.vue` — day side panel; render all kinds (done), add drag support
- `components/CalendarList.vue` (new) — list-based view of all calendar items grouped by day
- `components/AppHeader.vue` — replace standalone nav links with filter chips + view toggle
- `composables/useCalendar.ts` — add drag-based move/reschedule actions to mock + Supabase save
- `lib/mock.ts` — persist drag moves in-memory
- `lib/types.ts` — add `CalendarItemDrag` / move action types (if needed)

## Design decisions

### Root = calendar
The `/calendario` page is the single entry. `/newsletters` and `/site-updates` pages remain but their toolbar buttons now toggle calendar **filters** when on the calendar page, not navigation away.

### Filters
Three mutually-exclusive (or combinable) filter states: `all | posts | newsletters | site_updates`. Default `all`. Stored in a reactive ref on `calendario.vue`; `itemsByDay` computed filters before rendering. The toolbar chips highlight the active filter.

### List mode
New `CalendarList.vue` component: items grouped by `day`, each row shows kind color dot, title, time, status. Toggle between `month | week | list`. List mode is filter-aware.

### Drag & reorder
- Native HTML5 Drag-and-Drop on item chips/cards.
- Drag source = item kind+id; drop target = a day cell (month/week) or a list row.
- On drop: emit `move-item` with `{ id, kind, newDay }`; calendar updates the underlying row (`day` for posts, `scheduled_at`/`published_at` for newsletter/site-update) and re-sorts.
- Mock store handles `move_item` action; real Supabase path reuses existing `save` actions (mock-first since dev:mock is the target).
- Visual: drag-over highlight on target day/row; ghost opacity on source.

### Colors
Keep `ITEM_KIND_COLORS` (post uses topic color, newsletter blue, site_update purple) as the item border/dot. Keep format/status pills as secondary badges.

## Open questions (recommendations)

1. Drag library: use native HTML5 DnD (no new dep) vs `@vueuse/draggable`? Recommend **native HTML5 DnD** — zero dependencies, works in Nuxt SPA.
2. Filter persistence: store active filter + view in `localStorage`? Recommend **yes**, key `eg-calendar-filter` / `eg-calendar-view`.
3. Drag across month boundaries: dropping on adjacent-month cell should shift cursor to that month? Recommend **yes**, emit cursor change on drop into adjacent cell.

## Validation

- `pnpm typecheck` — no new errors in touched files (ignore pre-existing `supabase/functions/*`).
- `pnpm dev:mock` — dev server starts; calendar shows posts + newsletters + site updates; filter chips change visible items; list mode renders grouped rows; drag a chip to another day and the item moves (verified visually + via mock `version` bump).
- Manual: reload resets mock to seed; confirm December 2026 sample items appear across all three kinds.

## Out of scope

- Real Supabase edge-function drag endpoints (mock-only for now).
- Drag between month and week views simultaneously (each view independent).
- Recurring events.
