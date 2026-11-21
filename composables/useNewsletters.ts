/**
 * composables/useNewsletters.ts
 * @why Reactive store for newsletters.
 *
 * - reads  → edge function `newsletter-get`
 * - writes → edge function `newsletter-save` (manager gate)
 * - sync   → Supabase Realtime (`postgres_changes` on `newsletters`)
 * - local  → optimistic updates so the UI never waits on the network
 */
import type { Newsletter, NewsletterDraft, NewsletterStatus } from '~/lib/types'
import { useSupabase, edgeFunctionUrl } from '~/lib/supabase'
import { ref, computed, readonly } from 'vue'

const newsletters = ref<Newsletter[]>([])
const loading = ref(false)
const loaded = ref(false)
const saving = ref(false)
const lastSync = ref<Date | null>(null)
const realtimeStatus = ref<'connecting' | 'live' | 'offline'>('connecting')
const loadError = ref<string | null>(null)

let channel: ReturnType<ReturnType<typeof useSupabase>['channel']> | null = null
let snapshotInFlight = false

export function useNewsletters() {
  const supabase = useSupabase()
  const toast = useToast()
  const { session } = useSupabaseAuth()

  const byId = computed(() => {
    const map = new Map<string, Newsletter>()
    for (const n of newsletters.value) map.set(n.id, n)
    return map
  })

  const byStatus = computed(() => {
    const map = new Map<NewsletterStatus, Newsletter[]>()
    for (const n of newsletters.value) {
      const list = map.get(n.status) || []
      list.push(n)
      map.set(n.status, list)
    }
    return map
  })

  const stats = computed(() => ({
    total: newsletters.value.length,
    draft: newsletters.value.filter((n) => n.status === 'draft').length,
    scheduled: newsletters.value.filter((n) => n.status === 'scheduled').length,
    sent: newsletters.value.filter((n) => n.status === 'sent').length,
  }))

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

  async function load(force = false): Promise<void> {
    if (snapshotInFlight) return
    if (loaded.value && !force) return
    snapshotInFlight = true
    loading.value = true
    loadError.value = null
    try {
      const data = await fn<{ ok: boolean; newsletters: Newsletter[]; server_time: string }>(
        'newsletter-get',
        { method: 'GET' },
      )
      newsletters.value = data.newsletters ?? []
      loaded.value = true
      lastSync.value = new Date(data.server_time || Date.now())
    } catch (err) {
      loadError.value = err instanceof Error ? err.message : 'Could not load newsletters.'
      if (force) toast.error(loadError.value)
    } finally {
      loading.value = false
      snapshotInFlight = false
    }
  }

  function replaceNewsletter(row: Newsletter) {
    const i = newsletters.value.findIndex((n) => n.id === row.id)
    if (i >= 0) newsletters.value.splice(i, 1, row)
    else newsletters.value.push(row)
    newsletters.value = [...newsletters.value].sort(
      (a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''),
    )
  }

  async function save(action: {
    action: 'upsert_newsletter' | 'delete_newsletter'
    newsletter?: NewsletterDraft
    id?: string
  }): Promise<{ ok: boolean; newsletter?: Newsletter; error?: string }> {
    saving.value = true
    try {
      const result = await fn<{
        ok: boolean
        newsletter?: Newsletter
        error?: string
      }>('newsletter-save', {
        method: 'POST',
        body: JSON.stringify(action),
      })
      lastSync.value = new Date()

      if (result.newsletter) replaceNewsletter(result.newsletter)
      if (action.action === 'delete_newsletter') {
        newsletters.value = newsletters.value.filter((n) => n.id !== action.id)
      }

      return result
    } finally {
      saving.value = false
    }
  }

  const saveNewsletter = (newsletter: NewsletterDraft) =>
    save({ action: 'upsert_newsletter', newsletter })
  const deleteNewsletter = (id: string) => save({ action: 'delete_newsletter', id })

  function connectRealtime(): () => void {
    if (!import.meta.client || channel) return () => {}

    channel = supabase
      .channel(`newsletters-sync-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'newsletters' },
        (payload) => {
          const row = payload.new as Newsletter | undefined
          if (!row?.id) return
          if (payload.eventType === 'DELETE') {
            newsletters.value = newsletters.value.filter((n) => n.id !== row.id)
            return
          }
          replaceNewsletter(row)
          lastSync.value = new Date()
          realtimeStatus.value = 'live'
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

  async function init(): Promise<void> {
    const auth = useSupabaseAuth()
    await auth.bootstrap()
    if (!auth.isManager.value) return
    await load(true)
    connectRealtime()
  }

  return {
    newsletters: readonly(newsletters),
    loading: readonly(loading),
    loaded: readonly(loaded),
    saving: readonly(saving),
    lastSync: readonly(lastSync),
    realtimeStatus: readonly(realtimeStatus),
    loadError: readonly(loadError),
    byId,
    byStatus,
    stats,
    load,
    save,
    saveNewsletter,
    deleteNewsletter,
    connectRealtime,
    init,
    session,
  }
}
