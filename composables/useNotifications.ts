/**
 * composables/useNotifications.ts
 *
 * Persistent in-app notification inbox backed by Supabase.
 * Subscribes to realtime updates so the bell badge updates live.
 */
import { ref, shallowRef, computed } from 'vue'
import { edgeFunctionUrl } from '~/lib/supabase'
import { useSupabaseAuth } from '~/composables/useSupabaseAuth'
import { useSupabase } from '~/lib/supabase'

export interface Notification {
  id: string
  recipient_email: string
  event_type: string
  title: string
  body: string
  link_path: string
  source_type: string | null
  source_id: string | null
  read_at: string | null
  created_at: string
}

// ---- module-level shared state (singleton) ----
const notifications = shallowRef<Notification[]>([])
const loading = ref(false)
const panelOpen = ref(false)
let realtimeChannel: ReturnType<ReturnType<typeof useSupabase>['channel']> | null = null

export function useNotifications() {
  const { session, manager } = useSupabaseAuth()
  const supabase = useSupabase()

  function authHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.value?.access_token ?? ''}`,
      Origin: import.meta.client ? window.location.origin : '',
    }
  }

  // ---- fetch ----
  async function load(unreadOnly = false) {
    if (!session.value?.access_token) return
    loading.value = true
    try {
      const url = edgeFunctionUrl(`notification-get${unreadOnly ? '?unread_only=1&limit=200' : '?limit=100'}`)
      const res = await fetch(url, { method: 'GET', headers: authHeaders() })
      const data = await res.json()
      if (res.ok && data.ok) {
        notifications.value = data.notifications
      }
    } catch (err) {
      console.error('[useNotifications] load failed', err)
    } finally {
      loading.value = false
    }
  }

  // ---- mark read ----
  async function markRead(ids: string[]) {
    if (ids.length === 0) return
    try {
      await fetch(edgeFunctionUrl('notification-get'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'mark_read', ids }),
      })
      notifications.value = notifications.value.map((n) =>
        ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n,
      )
    } catch (err) {
      console.error('[useNotifications] markRead failed', err)
    }
  }

  async function markAllRead() {
    try {
      await fetch(edgeFunctionUrl('notification-get'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'mark_all_read' }),
      })
      const now = new Date().toISOString()
      notifications.value = notifications.value.map((n) => ({ ...n, read_at: n.read_at ?? now }))
    } catch (err) {
      console.error('[useNotifications] markAllRead failed', err)
    }
  }

  // ---- realtime ----
  function subscribeRealtime() {
    if (realtimeChannel) return
    const email = manager.value?.email
    if (!email) return

    realtimeChannel = supabase
      .channel(`notifications:${email}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_email=eq.${email}`,
        },
        (payload: { new: Notification }) => {
          notifications.value = [payload.new, ...notifications.value]
        },
      )
      .subscribe()
  }

  function unsubscribeRealtime() {
    if (realtimeChannel) {
      void supabase.removeChannel(realtimeChannel)
      realtimeChannel = null
    }
  }

  // ---- panel ----
  function openPanel() {
    panelOpen.value = true
    // Mark visible notifications as read after a short delay
    setTimeout(() => {
      const unreadIds = notifications.value.filter((n) => !n.read_at).map((n) => n.id)
      if (unreadIds.length > 0) void markRead(unreadIds)
    }, 1200)
  }

  function closePanel() {
    panelOpen.value = false
  }

  const unreadCount = computed(() => notifications.value.filter((n) => !n.read_at).length)

  return {
    notifications,
    loading,
    panelOpen,
    unreadCount,
    load,
    markRead,
    markAllRead,
    subscribeRealtime,
    unsubscribeRealtime,
    openPanel,
    closePanel,
  }
}
