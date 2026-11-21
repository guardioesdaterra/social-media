import type {
  CalendarPost,
  CalendarSnapshot,
  PostDraft,
  SaveAction,
  SaveResult,
  Topic,
} from '~/lib/types'
import { useSupabase, edgeFunctionUrl } from '~/lib/supabase'
import { ref, computed, watch, readonly } from 'vue'

/**
 * Reactive editorial-calendar store.
 *
 * - reads  → edge function `calendar-get`
 * - writes → edge function `calendar-save` (manager gate)
 * - sync   → Supabase Realtime (`postgres_changes`) so every open tab stays live
 * - local  → optimistic updates so the UI never waits on the network
 */
const topics = ref<Topic[]>([])
const posts = ref<CalendarPost[]>([])
const settings = ref<Record<string, unknown>>({})
const version = ref(0)
const loading = ref(false)
const loaded = ref(false)
const saving = ref(false)
const lastSync = ref<Date | null>(null)
const realtimeStatus = ref<'connecting' | 'live' | 'offline'>('connecting')
const loadError = ref<string | null>(null)

let channel: ReturnType<ReturnType<typeof useSupabase>['channel']> | null = null
let snapshotInFlight = false

export function useCalendar() {
  const supabase = useSupabase()
  const toast = useToast()
  const { session } = useSupabaseAuth()

  const byDay = computed(() => {
    const map = new Map<string, CalendarPost[]>()
    for (const p of posts.value) {
      const list = map.get(p.day)
      if (list) list.push(p)
      else map.set(p.day, [p])
    }
    for (const list of map.values()) list.sort((a, b) => a.sort_order - b.sort_order || a.created_at!.localeCompare(b.created_at ?? ''))
    return map
  })

  const byId = computed(() => {
    const map = new Map<string, CalendarPost>()
    for (const p of posts.value) map.set(p.id, p)
    return map
  })

  const topicByKey = computed(() => {
    const map = new Map<string, Topic>()
    for (const t of topics.value) map.set(t.key, t)
    return map
  })

  /** "Topics needing attention" sorted by priority rank (#1, #2, …). */
  const attentionTopics = computed(() =>
    topics.value
      .filter((t) => t.needs_attention && t.attention_rank != null)
      .sort((a, b) => (a.attention_rank ?? 0) - (b.attention_rank ?? 0) || a.sort - b.sort),
  )

  const stats = computed(() => {
    const total = posts.value.length
    const withImage = posts.value.filter((p) => p.image_base64).length
    const days = new Set(posts.value.map((p) => p.day)).size
    const byFormat: Record<string, number> = {}
    const byTopic: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    for (const p of posts.value) {
      byFormat[p.format] = (byFormat[p.format] || 0) + 1
      byTopic[p.topic_key] = (byTopic[p.topic_key] || 0) + 1
      byStatus[p.status] = (byStatus[p.status] || 0) + 1
    }
    return { total, withImage, days, byFormat, byTopic, byStatus }
  })

  async function authHeaders(): Promise<Record<string, string>> {
    const token = (await supabase.auth.getSession()).data.session?.access_token
    if (!token) throw new Error('Your session expired. Please sign in again.')
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-client-info': 'eg-social-media/1.0',
    }
  }

  async function fn<T>(path: string, init: RequestInit): Promise<T> {
    const res = await fetch(edgeFunctionUrl(path), {
      ...init,
      headers: {
        Origin: window.location.origin,
        ...(await authHeaders()),
        ...((init.headers as Record<string, string> | undefined) || {}),
      },
    })
    const text = await res.text()
    let data: unknown = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { error: text.slice(0, 400) }
    }
    if (!res.ok) {
      const err = (data as { error?: unknown } | null)?.error
      throw new Error(typeof err === 'string' ? err : `Request failed (HTTP ${res.status})`)
    }
    return data as T
  }

  /** Loads the full snapshot (topics + posts + settings). */
  async function load(force = false): Promise<void> {
    if (snapshotInFlight) return
    if (loaded.value && !force) return
    snapshotInFlight = true
    loading.value = true
    loadError.value = null
    try {
      const snap = await fn<CalendarSnapshot>('calendar-get', { method: 'GET' })
      topics.value = snap.topics || []
      posts.value = sortPosts(snap.posts || [])
      settings.value = Object.fromEntries((snap.settings || []).map((s) => [s.key, s.value]))
      version.value = snap.version || 0
      loaded.value = true
      lastSync.value = new Date(snap.server_time || Date.now())
    } catch (err) {
      loadError.value = err instanceof Error ? err.message : 'Could not load the calendar.'
      if (force) toast.error(loadError.value)
    } finally {
      loading.value = false
      snapshotInFlight = false
    }
  }

  function sortPosts(list: CalendarPost[]): CalendarPost[] {
    return [...list].sort(
      (a, b) => a.day.localeCompare(b.day) || a.sort_order - b.sort_order || (a.created_at ?? '').localeCompare(b.created_at ?? ''),
    )
  }

  function replacePost(row: CalendarPost) {
    const i = posts.value.findIndex((p) => p.id === row.id)
    if (i >= 0) posts.value.splice(i, 1, row)
    else posts.value.push(row)
    posts.value = sortPosts(posts.value)
  }

  function replaceTopic(row: Topic) {
    const i = topics.value.findIndex((t) => t.key === row.key)
    if (i >= 0) topics.value.splice(i, 1, row)
    else topics.value.push(row)
    topics.value = [...topics.value].sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label))
  }

  async function save(action: SaveAction): Promise<SaveResult> {
    saving.value = true
    try {
      const result = await fn<SaveResult>('calendar-save', {
        method: 'POST',
        body: JSON.stringify(action),
      })
      version.value = result.version
      lastSync.value = new Date()

      if (result.post) replacePost(result.post)
      if (result.posts) for (const p of result.posts) replacePost(p)
      if (result.topic) replaceTopic(result.topic)
      if (result.topics) {
        for (const t of result.topics) {
          const i = topics.value.findIndex((x) => x.key === t.key)
          if (i >= 0) topics.value.splice(i, 1, t)
          else topics.value.push(t)
        }
        topics.value = [...topics.value].sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label))
      }
      if (result.settings) for (const s of result.settings) settings.value[s.key] = s.value

      if (action.action === 'delete_post') posts.value = posts.value.filter((p) => p.id !== action.id)
      if (action.action === 'delete_topic') topics.value = topics.value.filter((t) => t.key !== action.key)

      return result
    } finally {
      saving.value = false
    }
  }

  const savePost = (post: PostDraft) => save({ action: 'upsert_post', post })
  const deletePost = (id: string) => save({ action: 'delete_post', id })
  const reorderPosts = (items: { id: string; day: string; sort_order: number }[]) =>
    save({ action: 'reorder_posts', items })
  const saveTopic = (topic: Topic) => save({ action: 'upsert_topic', topic })
  const deleteTopic = (key: string) => save({ action: 'delete_topic', key })
  const reorderTopics = (items: { key: string; sort: number }[][]) => save({ action: 'reorder_topics', items: items.flat() })
  const setAttention = (items: { key: string; attention_rank: number | null }[]) =>
    save({ action: 'set_attention', items })
  const saveSetting = (key: string, value: unknown) => save({ action: 'upsert_setting', key, value })

  /** Subscribes to the calendar tables so every open tab stays live. */
  function connectRealtime(): () => void {
    if (!import.meta.client || channel) return () => {}

    channel = supabase
      .channel(`calendar-sync-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_posts' },
        (payload) => {
          const row = payload.new as CalendarPost | undefined
          if (!row?.day) return
          if (payload.eventType === 'DELETE') {
            posts.value = posts.value.filter((p) => p.id !== row.id)
            return
          }
          replacePost(row)
          lastSync.value = new Date()
          realtimeStatus.value = 'live'
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_topics' },
        (payload) => {
          const row = payload.new as Topic | undefined
          if (!row?.key) return
          if (payload.eventType === 'DELETE') {
            topics.value = topics.value.filter((t) => t.key !== row.key)
            return
          }
          replaceTopic(row)
          lastSync.value = new Date()
        },
      )
      .subscribe((status) => {
        realtimeStatus.value =
          status === 'SUBSCRIBED'
            ? 'live'
            : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'
              ? 'offline'
              : 'connecting'
      })

    return () => {
      if (channel) {
        void supabase.removeChannel(channel)
        channel = null
      }
      realtimeStatus.value = 'connecting'
    }
  }

  /** Boot: auth → load snapshot → realtime. */
  async function init(): Promise<void> {
    const auth = useSupabaseAuth()
    await auth.bootstrap()
    if (!auth.isManager.value) return
    await load(true)
    connectRealtime()
  }

  return {
    topics: readonly(topics),
    posts: readonly(posts),
    settings: readonly(settings),
    version: readonly(version),
    loading: readonly(loading),
    loaded: readonly(loaded),
    saving: readonly(saving),
    lastSync: readonly(lastSync),
    realtimeStatus: readonly(realtimeStatus),
    loadError: readonly(loadError),
    byDay,
    byId,
    topicByKey,
    attentionTopics,
    stats,
    load,
    save,
    savePost,
    deletePost,
    reorderPosts,
    saveTopic,
    deleteTopic,
    reorderTopics,
    setAttention,
    saveSetting,
    connectRealtime,
    init,
    session,
  }
}
