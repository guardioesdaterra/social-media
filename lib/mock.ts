/**
 * lib/mock.ts
 * @why Client-side mock for `pnpm dev:mock`. Runs the app without Supabase:
 *   - fake manager login (no Google redirect, no Supabase auth)
 *   - in-memory calendar store (topics + posts + settings)
 *   - sample December 2026 editorial calendar data for testing
 *
 * Everything lives in memory; reload resets to the seed data.
 */
import type { CalendarPost, CalendarSnapshot, ManagerUser, PostDraft, SaveAction, SaveResult, Topic } from '~/lib/types'
import { parseIsoDay, todayIso } from '~/lib/calendar'

export function isMock(): boolean {
  return Boolean((useRuntimeConfig().public as Record<string, unknown>).mock)
}

export const MOCK_MANAGER: ManagerUser = {
  email: 'manager@earthguardians.org',
  name: 'Demo Manager',
  avatar: '',
}

const TOPICS: Topic[] = [
  {
    key: 'climate-action',
    label: 'Climate Action & Campaign',
    description: 'Campaigns, COP coverage and mobilization calls.',
    color: '#E8492B',
    emoji: '🌍',
    sort: 1,
    needs_attention: true,
    attention_rank: 1,
    updated_at: new Date().toISOString(),
    updated_by: MOCK_MANAGER.email,
  },
  {
    key: 'fundraising-mobilizing',
    label: 'Fundraising & Mobilizing',
    description: 'Donation drives, matched giving and year-end pushes.',
    color: '#F97316',
    emoji: '💖',
    sort: 2,
    needs_attention: true,
    attention_rank: 2,
    updated_at: new Date().toISOString(),
    updated_by: MOCK_MANAGER.email,
  },
  {
    key: 'impact-restoration',
    label: 'Impact & Restoration',
    description: 'Field results, tree counts and before/after stories.',
    color: '#14B8A6',
    emoji: '🌳',
    sort: 3,
    needs_attention: false,
    attention_rank: null,
    updated_at: new Date().toISOString(),
    updated_by: MOCK_MANAGER.email,
  },
  {
    key: 'awareness-days',
    label: 'Awareness Days & Events',
    description: 'International days, solstices and cultural dates.',
    color: '#EAB308',
    emoji: '📅',
    sort: 4,
    needs_attention: false,
    attention_rank: null,
    updated_at: new Date().toISOString(),
    updated_by: MOCK_MANAGER.email,
  },
  {
    key: 'crews-community',
    label: 'Crews & Community',
    description: 'Youth crews, spotlights and micro-actions.',
    color: '#22C55E',
    emoji: '👥',
    sort: 5,
    needs_attention: false,
    attention_rank: null,
    updated_at: new Date().toISOString(),
    updated_by: MOCK_MANAGER.email,
  },
]

const FORMATS = ['Carousel', 'Photo', 'Reel', 'Story', 'Video'] as const
const STATUSES = ['planned', 'production', 'approved', 'published'] as const

function uid(): string {
  return `mock_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function dowOf(iso: string): string {
  const { weekday } = parseIsoDay(iso)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday]!
}

const POSTS: CalendarPost[] = [
  {
    id: 'mock_p_1', day: '2026-12-01', year: 2026, month: 12, dow: 'Tue',
    topic_key: 'fundraising-mobilizing', format: 'Carousel',
    title: 'Giving Tuesday — matched donation',
    caption: 'Double your impact this Giving Tuesday. Every dollar is matched until midnight.',
    hashtags: '#GivingTuesday #Match', status: 'planned',
    image_base64: null, image_mime: null, image_name: null, image_bytes: null,
    sort_order: 0,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), updated_by: MOCK_MANAGER.email,
  },
  {
    id: 'mock_p_2', day: '2026-12-02', year: 2026, month: 12, dow: 'Wed',
    topic_key: 'climate-action', format: 'Reel',
    title: 'COP31: what came out of the negotiations',
    caption: 'Key takeaways from COP31 negotiations and what they mean for 2027.',
    hashtags: '#COP31 #Climate', status: 'production',
    image_base64: null, image_mime: null, image_name: null, image_bytes: null,
    sort_order: 0,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), updated_by: MOCK_MANAGER.email,
  },
  {
    id: 'mock_p_3', day: '2026-12-05', year: 2026, month: 12, dow: 'Sat',
    topic_key: 'awareness-days', format: 'Photo',
    title: 'World Soil Day',
    caption: 'Healthy soil, healthy planet. Celebrating World Soil Day with our restoration crews.',
    hashtags: '#WorldSoilDay #Restoration', status: 'planned',
    image_base64: null, image_mime: null, image_name: null, image_bytes: null,
    sort_order: 0,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), updated_by: MOCK_MANAGER.email,
  },
  {
    id: 'mock_p_4', day: '2026-12-10', year: 2026, month: 12, dow: 'Thu',
    topic_key: 'crews-community', format: 'Story',
    title: 'Crew spotlight: quick questions',
    caption: "Meet the team behind the trees. Quick questions with this month's spotlight crew.",
    hashtags: '#CrewSpotlight #Community', status: 'approved',
    image_base64: null, image_mime: null, image_name: null, image_bytes: null,
    sort_order: 0,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), updated_by: MOCK_MANAGER.email,
  },
  {
    id: 'mock_p_5', day: '2026-12-21', year: 2026, month: 12, dow: 'Mon',
    topic_key: 'climate-action', format: 'Video',
    "title": "The ED's end-of-year message",
    caption: 'A reflection on 2026 and a look ahead to COP32.',
    hashtags: '#EndOfYear #COP32', status: 'published',
    image_base64: null, image_mime: null, image_name: null, image_bytes: null,
    sort_order: 0,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), updated_by: MOCK_MANAGER.email,
  },
  {
    id: 'mock_p_6', day: '2026-12-28', year: 2026, month: 12, dow: 'Mon',
    topic_key: 'impact-restoration', format: 'Carousel',
    title: '2026 impact report in numbers',
    caption: 'Trees planted, crews trained and carbon kept in the ground — 2026 by the numbers.',
    hashtags: '#ImpactReport #2026', status: 'planned',
    image_base64: null, image_mime: null, image_name: null, image_bytes: null,
    sort_order: 0,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), updated_by: MOCK_MANAGER.email,
  },
]

let topics = [...TOPICS]
let posts = [...POSTS]
let version = 1
let settings: Record<string, unknown> = {
  default_year: 2026,
  default_month: 12,
  week_start: 'sunday',
}

function sortPosts(list: CalendarPost[]): CalendarPost[] {
  return [...list].sort(
    (a, b) => a.day.localeCompare(b.day) || a.sort_order - b.sort_order || (a.created_at ?? '').localeCompare(b.created_at ?? ''),
  )
}

export function useMockCalendar() {
  function load(): CalendarSnapshot {
    return {
      topics: [...topics],
      posts: sortPosts(posts),
      settings: Object.entries(settings).map(([key, value]) => ({ key, value })),
      server_time: new Date().toISOString(),
      version,
    }
  }

  function save(action: SaveAction): SaveResult {
    version++
    switch (action.action) {
      case 'upsert_post': {
        const post = action.post as PostDraft
        const row: CalendarPost = {
          id: post.id ?? uid(),
          day: post.day,
          year: Number(post.day.slice(0, 4)),
          month: Number(post.day.slice(5, 7)),
          dow: dowOf(post.day),
          topic_key: post.topic_key,
          format: post.format ?? 'Carousel',
          title: post.title ?? 'Untitled post',
          caption: post.caption ?? '',
          hashtags: post.hashtags ?? '',
          status: post.status ?? 'planned',
          image_base64: post.image_base64 ?? null,
          image_mime: post.image_mime ?? null,
          image_name: post.image_name ?? null,
          image_bytes: post.image_bytes ?? null,
          sort_order: post.sort_order ?? 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          updated_by: MOCK_MANAGER.email,
        }
        const i = posts.findIndex((p) => p.id === row.id)
        if (i >= 0) posts[i] = row
        else posts.push(row)
        posts = sortPosts(posts)
        return { ok: true, action: 'upsert_post', post: row, version }
      }
      case 'delete_post':
        posts = posts.filter((p) => p.id !== action.id)
        return { ok: true, action: 'delete_post', version }
      case 'reorder_posts':
        for (const item of action.items) {
          const p = posts.find((x) => x.id === item.id)
          if (p) { p.day = item.day; p.sort_order = item.sort_order; p.updated_at = new Date().toISOString() }
        }
        posts = sortPosts(posts)
        return { ok: true, action: 'reorder_posts', version }
      case 'upsert_topic': {
        const row = { ...(action.topic as Topic), updated_at: new Date().toISOString(), updated_by: MOCK_MANAGER.email }
        const i = topics.findIndex((t) => t.key === row.key)
        if (i >= 0) topics[i] = row
        else topics.push(row)
        topics = [...topics].sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label))
        return { ok: true, action: 'upsert_topic', topic: row, version }
      }
      case 'delete_topic':
        topics = topics.filter((t) => t.key !== action.key)
        posts = posts.filter((p) => p.topic_key !== action.key)
        return { ok: true, action: 'delete_topic', version }
      case 'reorder_topics':
        for (const item of action.items) {
          const t = topics.find((x) => x.key === item.key)
          if (t) t.sort = item.sort
        }
        topics = [...topics].sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label))
        return { ok: true, action: 'reorder_topics', version }
      case 'set_attention':
        for (const item of action.items) {
          const t = topics.find((x) => x.key === item.key)
          if (t) { t.needs_attention = item.attention_rank != null; t.attention_rank = item.attention_rank ?? null }
        }
        return { ok: true, action: 'set_attention', version }
      case 'upsert_setting':
        settings[action.key] = action.value
        return {
          ok: true,
          action: 'upsert_setting',
          settings: Object.entries(settings).map(([key, value]) => ({ key, value })),
          version,
        }
      default:
        return { ok: false, action: action.action as any, version, error: 'Unknown mock action' }
    }
  }

  return { load, save, version: () => version }
}
