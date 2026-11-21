/**
 * lib/mock.ts
 * @why Client-side mock for `pnpm dev:mock`. Runs the app without Supabase:
 *   - fake manager login (no Google redirect, no Supabase auth)
 *   - in-memory store for calendar posts, newsletters and site updates
 *   - sample December 2026 editorial calendar data for testing
 *
 * Everything lives in memory; reload resets to the seed data.
 */
import type {
  CalendarPost,
  CalendarSnapshot,
  ManagerUser,
  Newsletter,
  NewsletterDraft,
  PostDraft,
  SaveAction,
  SaveResult,
  SiteUpdate,
  SiteUpdateDraft,
  Topic,
} from '~/lib/types'
import { parseIsoDay } from '~/lib/calendar'

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

function uid(prefix: string): string {
  return `mock_${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function dowOf(iso: string): string {
  const { weekday } = parseIsoDay(iso)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday]!
}

function isoTime(day: string, hhmm: string): string {
  return `${day}T${hhmm}:00`
}

const POSTS: CalendarPost[] = [
  {
    id: 'mock_p_1', day: '2026-12-01', year: 2026, month: 12, dow: 'Tue',
    topic_key: 'fundraising-mobilizing', format: 'Carousel',
    title: 'Giving Tuesday — matched donation',
    caption: 'Double your impact this Giving Tuesday. Every dollar is matched until midnight.',
    hashtags: '#GivingTuesday #Match', status: 'planned',
    scheduled_at: isoTime('2026-12-01', '10:00'),
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
    scheduled_at: isoTime('2026-12-02', '14:30'),
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
    scheduled_at: isoTime('2026-12-10', '09:00'),
    image_base64: null, image_mime: null, image_name: null, image_bytes: null,
    sort_order: 0,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), updated_by: MOCK_MANAGER.email,
  },
  {
    id: 'mock_p_5', day: '2026-12-21', year: 2026, month: 12, dow: 'Mon',
    topic_key: 'climate-action', format: 'Video',
    title: "The ED's end-of-year message",
    caption: 'A reflection on 2026 and a look ahead to COP32.',
    hashtags: '#EndOfYear #COP32', status: 'published',
    scheduled_at: isoTime('2026-12-21', '18:00'),
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
    scheduled_at: isoTime('2026-12-28', '11:00'),
    image_base64: null, image_mime: null, image_name: null, image_bytes: null,
    sort_order: 0,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), updated_by: MOCK_MANAGER.email,
  },
]

const NEWSLETTERS: Newsletter[] = [
  {
    id: 'mock_n_1',
    title: 'December 2026 — Year in Review',
    subject: 'Our year in review + what\'s next',
    body: '<p>Greetings EG Family! Here is a look back at 2026 and what we have planned for 2027.</p>',
    status: 'scheduled',
    scheduled_at: '2026-12-15T08:00:00',
    sent_at: null,
    recipient_list: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    updated_by: MOCK_MANAGER.email,
  },
  {
    id: 'mock_n_2',
    title: 'COP31 Outcomes',
    subject: 'Key takeaways from COP31',
    body: '<p>A summary of the COP31 negotiations and what they mean for our campaigns.</p>',
    status: 'draft',
    scheduled_at: null,
    sent_at: null,
    recipient_list: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    updated_by: MOCK_MANAGER.email,
  },
  {
    id: 'mock_n_3',
    title: 'Giving Tuesday Thank You',
    subject: 'Thank you for doubling your impact',
    body: '<p>Thank you to everyone who gave this Giving Tuesday.</p>',
    status: 'sent',
    scheduled_at: '2026-12-01T10:00:00',
    sent_at: '2026-12-01T10:05:00',
    recipient_list: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    updated_by: MOCK_MANAGER.email,
  },
]

const SITE_UPDATES: SiteUpdate[] = [
  {
    id: 'mock_s_1',
    title: 'Restoration Dashboard Launched',
    slug: 'restoration-dashboard',
    content: '<h1>Restoration Dashboard</h1><p>Track our reforestation progress live.</p>',
    status: 'published',
    published_at: '2026-11-20T12:00:00',
    url: 'https://earthguardians.org/restoration-dashboard',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    updated_by: MOCK_MANAGER.email,
  },
  {
    id: 'mock_s_2',
    title: 'COP32 Focus for 2027',
    slug: 'cop32-focus',
    content: '<h1>COP32 Focus</h1><p>Our priorities heading into COP32.</p>',
    status: 'draft',
    published_at: null,
    url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    updated_by: MOCK_MANAGER.email,
  },
]

let topics = [...TOPICS]
let posts = [...POSTS]
let newsletters = [...NEWSLETTERS]
let siteUpdates = [...SITE_UPDATES]
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

function sortNewsletters(list: Newsletter[]): Newsletter[] {
  return [...list].sort(
    (a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''),
  )
}

function sortSiteUpdates(list: SiteUpdate[]): SiteUpdate[] {
  return [...list].sort(
    (a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''),
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

  function loadNewsletters(): Newsletter[] {
    return sortNewsletters(newsletters)
  }

  function loadSiteUpdates(): SiteUpdate[] {
    return sortSiteUpdates(siteUpdates)
  }

  function save(action: SaveAction): SaveResult {
    version++
    switch (action.action) {
      case 'upsert_post': {
        const post = action.post as PostDraft
        const row: CalendarPost = {
          id: post.id ?? uid('post'),
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
          scheduled_at: post.scheduled_at ?? null,
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
      case 'move_item': {
        const { id, kind, day } = action
        if (kind === 'post') {
          const p = posts.find((x) => x.id === id)
          if (p) {
            p.day = day
            p.year = Number(day.slice(0, 4))
            p.month = Number(day.slice(5, 7))
            p.dow = dowOf(day)
            p.updated_at = new Date().toISOString()
            posts = sortPosts(posts)
          }
          return { ok: true, action: 'move_item', version }
        }
        if (kind === 'newsletter') {
          const n = newsletters.find((x) => x.id === id)
          if (n && n.scheduled_at) {
            const timePart = n.scheduled_at.slice(10) // keeps 'T10:00:00' or '' 
            n.scheduled_at = `${day}${timePart || 'T00:00:00'}`
            n.updated_at = new Date().toISOString()
            newsletters = sortNewsletters(newsletters)
          }
          return { ok: true, action: 'move_item', version }
        }
        if (kind === 'site_update') {
          const u = siteUpdates.find((x) => x.id === id)
          if (u && u.published_at) {
            const timePart = u.published_at.slice(10)
            u.published_at = `${day}${timePart || 'T00:00:00'}`
            u.updated_at = new Date().toISOString()
            siteUpdates = sortSiteUpdates(siteUpdates)
          }
          return { ok: true, action: 'move_item', version }
        }
        return { ok: false, action: 'move_item', version, error: 'Item not found' }
      }
      default:
        return { ok: false, action: action.action as any, version, error: 'Unknown mock action' }
    }
  }

  function saveNewsletter(draft: NewsletterDraft): Newsletter {
    version++
    const row: Newsletter = {
      id: draft.id ?? uid('newsletter'),
      title: draft.title,
      subject: draft.subject,
      body: draft.body,
      status: draft.status ?? 'draft',
      scheduled_at: draft.scheduled_at ?? null,
      sent_at: draft.sent_at ?? null,
      recipient_list: draft.recipient_list ?? '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: MOCK_MANAGER.email,
    }
    const i = newsletters.findIndex((n) => n.id === row.id)
    if (i >= 0) newsletters[i] = row
    else newsletters.push(row)
    newsletters = sortNewsletters(newsletters)
    return row
  }

  function deleteNewsletter(id: string): void {
    version++
    newsletters = newsletters.filter((n) => n.id !== id)
  }

  function saveSiteUpdate(draft: SiteUpdateDraft): SiteUpdate {
    version++
    const row: SiteUpdate = {
      id: draft.id ?? uid('site-update'),
      title: draft.title,
      slug: draft.slug,
      content: draft.content,
      status: draft.status ?? 'draft',
      published_at: draft.published_at ?? null,
      url: draft.url ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: MOCK_MANAGER.email,
    }
    const i = siteUpdates.findIndex((u) => u.id === row.id)
    if (i >= 0) siteUpdates[i] = row
    else siteUpdates.push(row)
    siteUpdates = sortSiteUpdates(siteUpdates)
    return row
  }

  function deleteSiteUpdate(id: string): void {
    version++
    siteUpdates = siteUpdates.filter((u) => u.id !== id)
  }

  return {
    load,
    loadNewsletters,
    loadSiteUpdates,
    save,
    saveNewsletter,
    deleteNewsletter,
    saveSiteUpdate,
    deleteSiteUpdate,
    version: () => version,
  }
}
