/**
 * composables/useAppClock.ts
 * @why App-wide clock shown in the header. Displays the current UTC time by
 * default; right-click the header to pick a timezone that applies to the whole
 * app (persisted in localStorage). Ticks every second.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'

const TZ_KEY = 'eg-app-timezone'

const DEFAULT_TZ = 'UTC'

/** Expanded list of major world timezones for the header clock picker. */
export const WORLD_TIMEZONES: string[] = [
  'UTC',
  'America/Nome',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Toronto',
  'America/Halifax',
  'America/Sao_Paulo',
  'America/Buenos_Aires',
  'Atlantic/South_Georgia',
  'Atlantic/Azores',
  'Europe/Reykjavik',
  'Europe/Dublin',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Moscow',
  'Europe/Istanbul',
  'Asia/Dubai',
  'Asia/Muscat',
  'Asia/Karachi',
  'Asia/Colombo',
  'Asia/Dhaka',
  'Asia/Rangun',
  'Asia/Bangkok',
  'Asia/Ho_Chi_Minh',
  'Asia/Kuala_Lumpur',
  'Asia/Shanghai',
  'Asia/Seoul',
  'Asia/Tokyo',
  'Asia/Yakutsk',
  'Australia/Perth',
  'Australia/Darwin',
  'Australia/Sydney',
  'Australia/Broken_Hill',
  'Australia/Lord_Howe',
  'Australia/Brisbane',
  'Australia/Hobart',
  'Australia_Current',
  'Pacific/Guam',
  'Pacific/Honolulu',
  'Pacific/Auckland',
  'Pacific/Fiji',
  'Pacific/Chatham',
]

function readTimezone(): string {
  if (!import.meta.client) return DEFAULT_TZ
  try {
    const stored = localStorage.getItem(TZ_KEY)
    if (stored) return stored
  } catch {
    // ignore
  }
  return DEFAULT_TZ
}

function writeTimezone(tz: string): void {
  if (!import.meta.client) return
  try {
    localStorage.setItem(TZ_KEY, tz)
  } catch {
    // ignore
  }
}

let timer: ReturnType<typeof setInterval> | null = null

export function useAppClock() {
  const timezone = ref<string>(readTimezone())
  const now = ref<Date>(new Date())

  const isUtc = computed(() => timezone.value === 'UTC')

  const formatted = computed(() => {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: timezone.value,
    }).format(now.value)
  })

  const timeOnly = computed(() => {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: timezone.value,
    }).format(now.value)
  })

  const tzLabel = computed(() => {
    try {
      return new Intl.DateTimeFormat('en-US', { timeZone: timezone.value, timeZoneName: 'longOffset' }).format(now.value)
    } catch {
      return timezone.value
    }
  })

  function tick() {
    now.value = new Date()
  }

  function setTimezone(tz: string): void {
    timezone.value = tz
    writeTimezone(tz)
  }

  /** Convert the current time to another timezone and return formatted string. */
  function convertTime(tz: string): string {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: tz,
      }).format(now.value)
    } catch {
      return 'Error'
    }
  }

  function start(): void {
    if (timer) return
    tick()
    timer = setInterval(tick, 1000)
  }

  function stop(): void {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  onMounted(() => {
    if (import.meta.client) start()
  })

  onUnmounted(() => {
    stop()
  })

  return {
    now: computed(() => now.value),
    timezone,
    isUtc,
    formatted,
    timeOnly,
    tzLabel,
    setTimezone,
    start,
    stop,
    convertTime,
    WORLD_TIMEZONES,
  }
}
