/**
 * composables/usePresence.ts
 * @why "Online now" presence simulation for the dashboard.
 *
 * On every page opening a random set of "Google accounts" is marked as online.
 * Each account carries an avatar, a name, a live cursor position on the page
 * and an activity state (idle / writing / selecting / clicking). Activity
 * changes surface toasts ("writing…", "selecting…") and move the visual
 * cursors so you can see where each account is clicking or writing.
 */

import { ref, computed, readonly } from 'vue'
import { useToast } from '~/composables/useToast'

export type PresenceActivity = 'idle' | 'writing' | 'selecting' | 'clicking'

export interface PresenceUser {
  id: string
  name: string
  email: string
  avatar: string
  /** Last known cursor position in page coordinates (CSS px). */
  x: number
  y: number
  activity: PresenceActivity
  /** Element the user is interacting with (selector-ish hint). */
  target: string
  updatedAt: number
}

const NAMES = [
  'Alex Morgan',
  'Sam Rivera',
  'Jordan Lee',
  'Taylor Kim',
  'Casey Brooks',
  'Riley Chen',
  'Quinn Parker',
  'Drew Santos',
  'Avery Ngo',
  'Morgan Vale',
]

const AVATAR_SEEDS = NAMES.map((n) => n.toLowerCase().replace(' ', ''))

function avatarUrl(seed: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&radius=50`
}

const ACTIVITIES: PresenceActivity[] = ['idle', 'writing', 'selecting', 'clicking']

const ACTIVITY_LABELS: Record<PresenceActivity, string> = {
  idle: '',
  writing: 'writing…',
  selecting: 'selecting…',
  clicking: 'clicking…',
}

const users = ref<PresenceUser[]>([])
const me = ref<PresenceUser | null>(null)

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)] as T
}

/** Boot presence: pick a random subset of accounts to be online right now. */
function initPresence() {
  if (!import.meta.client) return
  const count = randomInt(3, 6)
  const seeds = [...AVATAR_SEEDS].sort(() => 0.5 - Math.random()).slice(0, count)
  const list: PresenceUser[] = seeds.map((seed, i) => ({
    id: `presence_${i}`,
    name: pick(NAMES),
    email: `${seed}@google.com`,
    avatar: avatarUrl(seed),
    x: randomInt(40, window.innerWidth - 120),
    y: randomInt(120, window.innerHeight - 120),
    activity: 'idle',
    target: 'page',
    updatedAt: Date.now(),
  }))
  users.value = list
  me.value = pick(list)
  startActivityLoop()
}

let loopId: ReturnType<typeof setInterval> | null = null

function startActivityLoop() {
  if (loopId) return
  loopId = setInterval(() => {
    for (const u of users.value) {
      // Randomly jitter the cursor.
      u.x = Math.max(20, Math.min(window.innerWidth - 100, u.x + randomInt(-60, 60)))
      u.y = Math.max(80, Math.min(window.innerHeight - 100, u.y + randomInt(-40, 40)))
      const roll = Math.random()
      const prev = u.activity
      if (roll < 0.06) u.activity = 'writing'
      else if (roll < 0.12) u.activity = 'selecting'
      else if (roll < 0.16) u.activity = 'clicking'
      else u.activity = 'idle'
      u.target = roll < 0.2 ? randomTarget() : 'page'
      u.updatedAt = Date.now()

      if (prev !== u.activity && u.activity !== 'idle') {
        void toast.push(`${u.name} is ${ACTIVITY_LABELS[u.activity]} on ${u.target}`, 'info', 3000)
      }
    }
  }, 2500)
}

function randomTarget(): string {
  const targets = [
    'compose field', 'calendar grid', 'post card', 'approve button', 'decline button',
    'comment field', 'topic selector', 'schedule picker', 'search bar',
  ]
  return pick(targets)
}

const toast = useToast()

function stop() {
  if (loopId) {
    clearInterval(loopId)
    loopId = null
  }
}

export function usePresence() {
  return {
    users: readonly(users),
    me: readonly(me),
    onlineCount: computed(() => users.value.length),
    activeUsers: computed(() => users.value.filter((u) => u.activity !== 'idle')),
    initPresence,
    stop,
    toastPush: (text: string) => void toast.push(text, 'info', 3000),
  }
}
