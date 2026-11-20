/**
 * Domain types for the @earthguardians editorial calendar.
 * All labels exposed to the UI are English.
 */

export type PostFormat = 'Carousel' | 'Photo' | 'Reel' | 'Story' | 'Video'

export type PostStatus = 'planned' | 'production' | 'approved' | 'published'

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
  /** Order inside `day`. */
  sort_order: number
  created_at?: string
  updated_at: string
  updated_by: string | null
}

/** Draft accepted by the `upsert_post` action. */
export interface PostDraft {
  id?: string
  day: string
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

export type SaveActionName = SaveAction['action']

export interface SaveResult {
  ok: boolean
  action: SaveActionName
  post?: CalendarPost
  posts?: CalendarPost[]
  topic?: Topic
  topics?: Topic[]
  settings?: CalendarSetting[]
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
