/**
 * Domain types for the @earthguardians editorial calendar.
 * All labels exposed to the UI are English.
 */

export type PostFormat = 'Carousel' | 'Photo' | 'Reel' | 'Story' | 'Video'

export type PostStatus = 'planned' | 'production' | 'approved' | 'published'

export type NewsletterStatus = 'draft' | 'scheduled' | 'sent'

export type SiteUpdateStatus = 'draft' | 'published' | 'archived'

export const FORMATS: readonly PostFormat[] = ['Carousel', 'Photo', 'Reel', 'Story', 'Video'] as const

export const STATUSES: { value: PostStatus; label: string; color: string }[] = [
  { value: 'planned', label: 'Planned', color: '#71717a' },
  { value: 'production', label: 'In production', color: '#eab308' },
  { value: 'approved', label: 'Approved', color: '#3b82f6' },
  { value: 'published', label: 'Published', color: '#22c55e' },
]

/** A topic (formerly "pillar"). Every post must be linked to exactly one. */
export interface Topic {
  key: string
  label: string
  description: string
  color: string
  emoji: string
  /** Legend / list order. */
  sort: number
  /** Whether the topic shows up in "Topics needing attention". */
  needs_attention: boolean
  /** 1 = highest priority. `null` when `needs_attention` is false. */
  attention_rank: number | null
  updated_at?: string
  updated_by?: string | null
}

/** A single scheduled post. Multiple posts can share the same `day`. */
export interface CalendarPost {
  id: string
  /** `YYYY-MM-DD` */
  day: string
  /** Optional scheduled time `HH:mm` or full ISO datetime. */
  scheduled_at?: string | null
  /** Derived from `day` (stored). */
  year: number
  /** 1..12, derived from `day` (stored). */
  month: number
  /** `Sun`..`Sat`, derived from `day` (stored). */
  dow: string
  /** Required — every post is linked to a topic. */
  topic_key: string
  format: PostFormat
  title: string
  caption: string
  hashtags: string
  status: PostStatus
  /** Data URL (`data:image/jpeg;base64,...`) stored in Postgres, not in S3. */
  image_base64: string | null
  image_mime: string | null
  image_name: string | null
  image_bytes: number | null
  /** Every slide of a Carousel post (data URLs, in order). Cover also lives in `image_base64`. */
  image_slides?: readonly string[] | null
  /** Data URL (`data:video/mp4;base64,...`) stored in Postgres, not in S3. */
  video_base64: string | null
  video_mime: string | null
  video_name: string | null
  video_bytes: number | null
  /** Order inside `day`. */
  sort_order: number
  created_at?: string
  updated_at: string
  updated_by: string | null
}

/** A scheduled email newsletter. */
export interface Newsletter {
  id: string
  title: string
  subject: string
  body: string
  status: NewsletterStatus
  scheduled_at: string | null
  sent_at: string | null
  recipient_list: string
  created_at?: string
  updated_at: string
  updated_by: string | null
}

/** Draft accepted by the `upsert_newsletter` action. */
export interface NewsletterDraft {
  id?: string
  title: string
  subject: string
  body: string
  status?: NewsletterStatus
  scheduled_at?: string | null
  sent_at?: string | null
  recipient_list?: string
}

/** A website page update. */
export interface SiteUpdate {
  id: string
  title: string
  slug: string
  content: string
  status: SiteUpdateStatus
  published_at: string | null
  url: string | null
  // Wayback integration fields
  wayback_url?: string | null  // Original URL for Wayback snapshots
  snapshot_timestamps?: readonly string[]  // Array of captured timestamps
  last_diff?: string | null  // JSON string of last diff
  created_at?: string
  updated_at: string
  updated_by: string | null
}

/** Draft accepted by the `upsert_site_update` action. */
export interface SiteUpdateDraft {
  id?: string
  title: string
  slug: string
  content: string
  status?: SiteUpdateStatus
  published_at?: string | null
  url?: string | null
  // Wayback integration
  wayback_url?: string | null
  snapshot_timestamps?: string[]
  last_diff?: string | null
}
export interface PostDraft {
  id?: string
  day: string
  scheduled_at?: string | null
  topic_key: string
  format?: PostFormat
  title?: string
  caption?: string
  hashtags?: string
  status?: PostStatus
  image_base64?: string | null
  image_mime?: string | null
  image_name?: string | null
  image_bytes?: number | null
  image_slides?: readonly string[] | null
  video_base64?: string | null
  video_mime?: string | null
  video_name?: string | null
  video_bytes?: number | null
  sort_order?: number
}

export interface CalendarSetting {
  key: string
  value: unknown
  updated_at?: string
}

/** Full response of the `calendar-get` edge function. */
export interface CalendarSnapshot {
  topics: Topic[]
  posts: CalendarPost[]
  settings: CalendarSetting[]
  server_time: string
  /** Monotonic counter, bumped on every save — used to reconcile realtime. */
  version: number
}

export interface ManagerUser {
  email: string
  name: string
  avatar: string
}

export type SaveAction =
  | { action: 'upsert_post'; post: PostDraft }
  | { action: 'delete_post'; id: string }
  | { action: 'reorder_posts'; items: { id: string; day: string; sort_order: number }[] }
  | { action: 'upsert_topic'; topic: Topic }
  | { action: 'delete_topic'; key: string }
  | { action: 'reorder_topics'; items: { key: string; sort: number }[] }
  | { action: 'set_attention'; items: { key: string; attention_rank: number | null }[] }
  | { action: 'upsert_setting'; key: string; value: unknown }
  | { action: 'upsert_newsletter'; newsletter: NewsletterDraft }
  | { action: 'delete_newsletter'; id: string }
  | { action: 'upsert_site_update'; site_update: SiteUpdateDraft }
  | { action: 'delete_site_update'; id: string }
  | { action: 'move_item'; id: string; kind: CalendarItemKind; day: string }

export type SaveActionName = SaveAction['action']

export interface SaveResult {
  ok: boolean
  action: SaveActionName
  post?: CalendarPost
  posts?: CalendarPost[]
  topic?: Topic
  topics?: Topic[]
  settings?: CalendarSetting[]
  newsletter?: Newsletter
  site_update?: SiteUpdate
  version: number
  error?: string
}

/* ------------------------------------------------------------------ */
/* Presentation helpers (English)                                     */
/* ------------------------------------------------------------------ */

export const DOW_SHORT: readonly string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const DOW_FULL: readonly string[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

export const MONTHS: readonly string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export const MONTHS_SHORT: readonly string[] = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/** Statuses for `<select>` rendering. */
export function statusLabel(s: PostStatus): string {
  return STATUSES.find((x) => x.value === s)?.label ?? s
}

/* ------------------------------------------------------------------ */
/* Unified calendar item (posts + newsletters + site updates)         */
/* ------------------------------------------------------------------ */

export type CalendarItemKind = 'post' | 'newsletter' | 'site_update'

/** Highlight color per calendar-item kind. */
export const ITEM_KIND_COLORS: Record<CalendarItemKind, string> = {
  post: '#71717a',
  newsletter: '#3b82f6',
  site_update: '#a855f7',
}

export function itemKindColor(kind: CalendarItemKind): string {
  return ITEM_KIND_COLORS[kind] ?? '#71717a'
}

export function itemKindLabel(kind: CalendarItemKind): string {
  const map: Record<CalendarItemKind, string> = {
    post: 'Post',
    newsletter: 'Newsletter',
    site_update: 'Site update',
  }
  return map[kind]
}

/** Base fields shared by every calendar item. */
export interface CalendarItemBase {
  kind: CalendarItemKind
  id: string
  /** `YYYY-MM-DD` local date derived from the scheduled time. */
  day: string
  title: string
  /** Optional `HH:mm` or ISO time string for display. */
  time?: string | null
  status?: string | null
  color: string
}

export interface CalendarItemPost extends CalendarItemBase {
  kind: 'post'
  post: CalendarPost
}

export interface CalendarItemNewsletter extends CalendarItemBase {
  kind: 'newsletter'
  newsletter: Newsletter
}

export interface CalendarItemSiteUpdate extends CalendarItemBase {
  kind: 'site_update'
  site_update: SiteUpdate
}

export type CalendarItem =
  | CalendarItemPost
  | CalendarItemNewsletter
  | CalendarItemSiteUpdate

/** Build a calendar item from any of the three domain rows. */
export function makeCalendarItem(row: CalendarPost | Newsletter | SiteUpdate, kind: CalendarItemKind): CalendarItem {
  const base: CalendarItemBase = {
    kind,
    id: row.id,
    /** `YYYY-MM-DD` local date derived from the scheduled time. */
    day: kind === 'post'
      ? (row as CalendarPost).day
      : kind === 'newsletter'
        ? String((row as Newsletter).scheduled_at ?? '').slice(0, 10)
        : String((row as SiteUpdate).published_at ?? '').slice(0, 10),
    title: kind === 'post'
      ? (row as CalendarPost).title
      : kind === 'newsletter'
        ? (row as Newsletter).title
        : (row as SiteUpdate).title,
    /** Optional `HH:mm` or ISO time string for display. */
    time: kind === 'post'
      ? (row as CalendarPost).scheduled_at ?? null
      : kind === 'newsletter'
        ? (row as Newsletter).scheduled_at ?? null
        : (row as SiteUpdate).published_at ?? null,
    status: kind === 'post'
      ? (row as CalendarPost).status
      : kind === 'newsletter'
        ? (row as Newsletter).status
        : (row as SiteUpdate).status,
    color: itemKindColor(kind),
  }

  switch (kind) {
    case 'post':
      return { ...base, kind: 'post', post: row as CalendarPost }
    case 'newsletter':
      return { ...base, kind: 'newsletter', newsletter: row as Newsletter }
    case 'site_update':
      return { ...base, kind: 'site_update', site_update: row as SiteUpdate }
  }
}

