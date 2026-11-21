/**
 * composables/useSiteUpdates.ts
 * @why Reactive store for site updates.
 *
 * - reads  → edge function `site-update-get`
 * - writes → edge function `site-update-save` (manager gate)
 * - sync   → Supabase Realtime (`postgres_changes` on `site_updates`)
 * - local  → optimistic updates so the UI never waits on the network
 */
import type { SiteUpdate, SiteUpdateDraft, SiteUpdateStatus } from '~/lib/types'
import { useSupabase, edgeFunctionUrl } from '~/lib/supabase'
import { ref, computed, readonly } from 'vue'

const siteUpdates = ref<SiteUpdate[]>([])
const loading = ref(false)
const loaded = ref(false)
const saving = ref(false)
const lastSync = ref<Date | null>(null)
const realtimeStatus = ref<'connecting' | 'live' | 'offline'>('connecting')
const loadError = ref<string | null>(null)

let channel: ReturnType<ReturnType<typeof useSupabase>['channel']> | null = null
let snapshotInFlight = false

export function useSiteUpdates() {
  const supabase = useSupabase()
  const toast = useToast()
  const { session } = useSupabaseAuth()

  const byId = computed(() => {
    const map = new Map<string, SiteUpdate>()
    for (const u of siteUpdates.value) map.set(u.id, u)
    return map
  })

  const byStatus = computed(() => {
    const map = new Map<SiteUpdateStatus, SiteUpdate[]>()
    for (const u of siteUpdates.value) {
      const list = map.get(u.status) || []
      list.push(u)
      map.set(u.status, list)
    }
    return map
  })

  const stats = computed(() => ({
    total: siteUpdates.value.length,
    draft: siteUpdates.value.filter((u) => u.status === 'draft').length,
    published: siteUpdates.value.filter((u) => u.status === 'published').length,
    archived: siteUpdates.value.filter((u) => u.status === 'archived').length,
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
    let data: unknown
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
      const data = await fn<{
        ok: boolean
        site_updates: SiteUpdate[]
        server_time: string
      }>('site-update-get', { method: 'GET' })
      siteUpdates.value = data.site_updates ?? []
      loaded.value = true
      lastSync.value = new Date(data.server_time || Date.now())
    } catch (err) {
      loadError.value = err instanceof Error ? err.message : 'Could not load site updates.'
      if (force) toast.error(loadError.value)
    } finally {
      loading.value = false
      snapshotInFlight = false
    }
  }

  function replaceSiteUpdate(row: SiteUpdate) {
    const i = siteUpdates.value.findIndex((u) => u.id === row.id)
    if (i >= 0) siteUpdates.value.splice(i, 1, row)
    else siteUpdates.value.push(row)
    siteUpdates.value = [...siteUpdates.value].sort(
      (a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''),
    )
  }

  async function save(action: {
    action: 'upsert_site_update' | 'delete_site_update'
    site_update?: SiteUpdateDraft
    id?: string
  }): Promise<{ ok: boolean; site_update?: SiteUpdate; error?: string }> {
    saving.value = true
    try {
      const result = await fn<{
        ok: boolean
        site_update?: SiteUpdate
        error?: string
      }>('site-update-save', {
        method: 'POST',
        body: JSON.stringify(action),
      })
      lastSync.value = new Date()

      if (result.site_update) replaceSiteUpdate(result.site_update)
      if (action.action === 'delete_site_update') {
        siteUpdates.value = siteUpdates.value.filter((u) => u.id !== action.id)
      }

      return result
    } finally {
      saving.value = false
    }
  }

  const saveSiteUpdate = (siteUpdate: SiteUpdateDraft) =>
    save({ action: 'upsert_site_update', site_update: siteUpdate })
  const deleteSiteUpdate = (id: string) => save({ action: 'delete_site_update', id })

  function connectRealtime(): () => void {
    if (!import.meta.client || channel) return () => {}

    channel = supabase
      .channel(`site-updates-sync-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_updates' },
        (payload) => {
          const row = payload.new as SiteUpdate | undefined
          if (!row?.id) return
          if (payload.eventType === 'DELETE') {
            siteUpdates.value = siteUpdates.value.filter((u) => u.id !== row.id)
            return
          }
          replaceSiteUpdate(row)
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
    siteUpdates: readonly(siteUpdates),
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
    saveSiteUpdate,
    deleteSiteUpdate,
    connectRealtime,
    init,
    session,
  }
}
