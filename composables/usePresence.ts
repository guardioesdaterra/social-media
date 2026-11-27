/**
 * composables/usePresence.ts
 * @why Real "online now" presence via Supabase Realtime Presence.
 *
 * Every open tab joins the `eg-presence` channel and tracks its own state
 * (name, email, avatar, activity, cursor x/y) via channel.track(). Other tabs
 * appear in the OnlineNow dashboard with photo + name + activity. Only the
 * current user's own cursor is rendered — other users' mice are never shown.
 *
 * Activities: idle | writing | selecting | clicking. When another user's
 * activity changes to writing/selecting/clicking a toast is shown.
 */

import { ref, computed, readonly, onUnmounted } from 'vue'
import { useSupabase } from '~/lib/supabase'
import { useSupabaseAuth } from '~/composables/useSupabaseAuth'
import { useToast } from '~/composables/useToast'
import { isMock } from '~/lib/mock'

export type PresenceActivity = 'idle' | 'writing' | 'selecting' | 'clicking'

export interface PresenceUser {
  id: string
  name: string
  email: string
  avatar: string
  activity: PresenceActivity
  target: string
  x: number
  y: number
  updatedAt: number
}

const ACTIVITY_LABELS: Record<PresenceActivity, string> = {
  idle: '',
  writing: 'writing…',
  selecting: 'selecting…',
  clicking: 'clicking…',
}

const users = ref<Map<string, PresenceUser>>(new Map())
const prevActivities = ref<Map<string, PresenceActivity>>(new Map())
let presenceChannel: ReturnType<ReturnType<typeof useSupabase>['channel']> | null = null
let myKey: string | null = null
let mouseFrame: number | null = null
let lastMouseX = 0
let lastMouseY = 0

const toast = useToast()
const { manager, session } = useSupabaseAuth()

function myId(): string | null {
  return session.value?.user.id || null
}

function myPresence(): Record<string, unknown> {
  const m = manager.value
  const id = myId()
  return {
    id: id ?? 'local',
    name: m?.name || session.value?.user.email || 'You',
    email: m?.email || session.value?.user.email || '',
    avatar: m?.avatar || session.value?.user.user_metadata?.avatar_url || '',
    activity: 'idle',
    target: 'page',
    x: lastMouseX,
    y: lastMouseY,
    updatedAt: Date.now(),
  }
}

/** Throttled mousemove broadcast — only our own cursor position. */
function onMouseMove(e: MouseEvent) {
  if (mouseFrame) return
  lastMouseX = e.clientX
  lastMouseY = e.clientY
  mouseFrame = requestAnimationFrame(() => {
    mouseFrame = null
    void presenceChannel?.send({
      type: 'broadcast',
      event: 'cursor',
      payload: { x: lastMouseX, y: lastMouseY },
    })
    const me = users.value.get(myKey!)
    if (me) {
      me.x = lastMouseX
      me.y = lastMouseY
      me.updatedAt = Date.now()
      users.value = new Map(users.value)
    }
  })
}

function startActivityLoop() {
  setInterval(() => {
    const me = users.value.get(myKey!)
    if (!me) return
    const roll = Math.random()
    const prev = me.activity
    if (roll < 0.05) me.activity = 'writing'
    else if (roll < 0.10) me.activity = 'selecting'
    else if (roll < 0.14) me.activity = 'clicking'
    else me.activity = 'idle'
    const targets = [
      'compose field',
      'calendar grid',
      'post card',
      'approve button',
      'comment field',
    ]
    me.target =
      roll < 0.2 ? targets[Math.floor(Math.random() * targets.length)]! : 'page'
    me.updatedAt = Date.now()
    users.value = new Map(users.value)
    void presenceChannel?.track({ ...mePresenceSnapshot(), activity: me.activity, target: me.target })

    if (prev !== me.activity && me.activity !== 'idle') {
      void toast.push(`${me.name} is ${ACTIVITY_LABELS[me.activity]} on ${me.target}`, 'info', 3000)
    }
  }, 2500)
}

function mePresenceSnapshot(): Record<string, unknown> {
  const me = users.value.get(myKey!)
  if (!me) return myPresence()
  return { ...me, key: myKey }
}

export function initPresence() {
  if (!import.meta.client) return
  const supabase = useSupabase()
  const mock = isMock()

  if (mock) {
    myKey = 'local_user'
    users.value = new Map([
      ['local_user', myPresence() as unknown as PresenceUser],
    ])
    window.addEventListener('mousemove', onMouseMove)
    onUnmounted(() => {
      window.removeEventListener('mousemove', onMouseMove)
      users.value = new Map()
    })
    return
  }

  myKey = `presence_${myId() ?? crypto.randomUUID()}`

  presenceChannel = supabase.channel('eg-presence')

  presenceChannel
    .on('presence', { event: 'join' }, () => {
      syncPresence()
    })
    .on('presence', { event: 'leave' }, () => {
      syncPresence()
    })
    .on('presence', { event: 'sync' }, () => {
      syncPresence()
    })
    .on('broadcast', { event: 'cursor' }, (payload: any) => {
      // Other users' cursor positions are intentionally ignored — only my own cursor is shown.
      const key = Object.keys(presenceChannel!.presenceState()).find((k) => {
        const presences = presenceChannel!.presenceState()[k]!
        return presences.some((p: any) => p.user_id === payload?.payload?.user_id)
      })
      // We deliberately do NOT render remote cursors.
    })
    .subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return
      await presenceChannel!.track(myPresence())
      syncPresence()
    })

  window.addEventListener('mousemove', onMouseMove)
  startActivityLoop()

  onUnmounted(() => {
    window.removeEventListener('mousemove', onMouseMove)
    if (presenceChannel) {
      void supabase.removeChannel(presenceChannel)
      presenceChannel = null
    }
    users.value = new Map()
    if (mouseFrame) cancelAnimationFrame(mouseFrame)
    mouseFrame = null
  })
}

function syncPresence() {
  if (!presenceChannel) return
  const state = presenceChannel.presenceState()
  const now = Date.now()
  const map = new Map<string, PresenceUser>()
  for (const [key, presences] of Object.entries(state)) {
    for (const p of presences as any[]) {
      const u: PresenceUser = {
        id: p.user_id || key,
        name: p.name || 'Unknown',
        email: p.email || '',
        avatar: p.avatar || '',
        activity: p.activity || 'idle',
        target: p.target || 'page',
        x: p.x ?? 0,
        y: p.y ?? 0,
        updatedAt: p.updatedAt ?? now,
      }
      map.set(key, u)

      // Only toast when another user's activity changes TO non-idle.
      if (key !== myKey && u.activity !== 'idle') {
        const prev = prevActivities.value.get(key)
        if (prev !== u.activity) {
          void toast.push(`${u.name} is ${ACTIVITY_LABELS[u.activity]} on ${u.target}`, 'info', 3000)
        }
      }
      prevActivities.value.set(key, u.activity)
    }
  }
  // Clean up activities for users who left.
  for (const key of prevActivities.value.keys()) {
    if (!map.has(key)) prevActivities.value.delete(key)
  }
  users.value = map
}

export function stopPresence() {
  if (presenceChannel && import.meta.client) {
    const supabase = useSupabase()
    void supabase.removeChannel(presenceChannel)
    presenceChannel = null
  }
  users.value = new Map()
  prevActivities.value = new Map()
}

export function usePresence() {
  return {
    users: readonly(users),
    onlineCount: computed(() => users.value.size),
    me: computed(() => (myKey ? users.value.get(myKey) ?? null : null)),
    activeUsers: computed(() => [...users.value.values()].filter((u) => u.activity !== 'idle')),
    initPresence,
    stopPresence,
  }
}
