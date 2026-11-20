<template>
  <section class="eg-card overflow-hidden" aria-label="Month calendar">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-2 border-b border-[var(--eg-border)] px-3 py-2.5 sm:px-4">
      <div class="flex items-center gap-1">
        <button class="eg-btn-ghost !px-2.5 !py-1.5" aria-label="Previous month" @click="shift(-1)">‹</button>
        <button class="eg-btn-ghost !px-2.5 !py-1.5" aria-label="Next month" @click="shift(1)">›</button>
        <button class="eg-btn-ghost !px-3 !py-1.5 text-xs" @click="goToday">Today</button>
      </div>

      <h1 class="flex-1 text-center text-base font-semibold text-white sm:text-lg">
        {{ monthLabel(year, month) }}
        <span class="ml-1 text-sm font-normal text-zinc-500">· {{ monthPostCount }} post{{ monthPostCount === 1 ? '' : 's' }}</span>
      </h1>

      <div class="flex items-center gap-1.5">
        <select
          class="eg-input !w-auto !py-1.5 text-xs"
          :value="year"
          aria-label="Year"
          @change="onYear"
        >
          <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
        </select>
        <select
          class="eg-input !w-auto !py-1.5 text-xs"
          :value="month"
          aria-label="Month"
          @change="onMonth"
        >
          <option v-for="(m, i) in MONTHS" :key="m" :value="i + 1">{{ m }}</option>
        </select>
      </div>
    </div>

    <!-- Weekday headers -->
    <div class="grid grid-cols-7 border-b border-[var(--eg-border)] bg-white/[0.02]">
      <div
        v-for="(d, i) in DOW_SHORT"
        :key="d"
        class="px-1 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider sm:text-xs"
        :class="i === 0 ? 'text-red-400/70' : 'text-zinc-500'"
      >
        <span class="hidden sm:inline">{{ DOW_FULL[i] }}</span>
        <span class="sm:hidden">{{ d }}</span>
      </div>
    </div>

    <!-- Weeks -->
    <div class="grid grid-cols-7">
      <template v-for="(week, wi) in weeks" :key="wi">
        <button
          v-for="cell in week"
          :key="cell.date"
          type="button"
          class="group relative min-h-[62px] border-b border-r border-[var(--eg-border)] p-1 text-left transition
            last:border-r-0 sm:min-h-[112px] sm:p-1.5"
          :class="cellClasses(cell)"
          :aria-label="cell.aria"
          :aria-pressed="cell.date === selected"
          @click="emit('select', cell.date)"
        >
          <span class="flex items-start justify-between gap-1">
            <span
              class="inline-grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-semibold sm:h-6 sm:min-w-6 sm:text-xs"
              :class="dayNumberClass(cell)"
            >
              {{ cell.day }}
            </span>
            <span
              v-if="cell.count"
              class="rounded-full bg-white/10 px-1 text-[9px] font-medium text-zinc-300 sm:text-[10px]"
            >{{ cell.count }}</span>
          </span>

          <!-- Post chips (desktop) -->
          <span class="mt-1 hidden flex-col gap-0.5 sm:flex">
            <span
              v-for="p in cell.previews"
              :key="p.id"
              class="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] leading-tight"
              :style="{ background: topicColor(p.topic_key) + '26', color: topicColor(p.topic_key) }"
            >
              <span class="h-1.5 w-1.5 shrink-0 rounded-full" :style="{ background: topicColor(p.topic_key) }" />
              <span class="truncate text-zinc-200">{{ p.title || 'Untitled' }}</span>
            </span>
            <span v-if="cell.more > 0" class="px-1 text-[10px] text-zinc-500">+{{ cell.more }} more</span>
          </span>

          <!-- Dots (mobile) -->
          <span class="mt-1 flex flex-wrap gap-0.5 sm:hidden">
            <span
              v-for="p in cell.previews.slice(0, 4)"
              :key="p.id"
              class="h-1.5 w-1.5 rounded-full"
              :style="{ background: topicColor(p.topic_key) }"
            />
          </span>
        </button>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CalendarPost, Topic } from '~/lib/types'
import { DOW_FULL, DOW_SHORT, MONTHS } from '~/lib/types'
import { buildMonthGrid, monthLabel, todayIso, weeksOf, toIsoDay, parseIsoDay } from '~/lib/calendar'

const props = defineProps<{
  cursor: string
  selected: string
  postsByDay: Map<string, CalendarPost[]>
  topics: Topic[]
}>()

const emit = defineEmits<{ select: [day: string] }>()

const toast = useToast()

const { year, month } = toRefs(
  reactive({
    year: parseIsoDay(props.cursor).year,
    month: parseIsoDay(props.cursor).month,
  }),
)

watch(
  () => props.cursor,
  (v) => {
    const p = parseIsoDay(v)
    year.value = p.year
    month.value = p.month
  },
)

const years = computed(() => {
  const now = new Date().getFullYear()
  return Array.from({ length: 9 }, (_, i) => now - 2 + i)
})

const grid = computed(() => buildMonthGrid(year.value, month.value))
const weeks = computed(() => weeksOf(grid.value))

const monthPostCount = computed(() => {
  let n = 0
  for (const list of props.postsByDay.values()) {
    for (const p of list) if (p.year === year.value && p.month === month.value) n++
  }
  return n
})

const topicMap = computed(() => {
  const m = new Map<string, Topic>()
  for (const t of props.topics) m.set(t.key, t)
  return m
})

function topicColor(key: string): string {
  return topicMap.value.get(key)?.color || '#71717a'
}

interface CellView {
  date: string
  day: number
  weekday: number
  adjacent: boolean
  count: number
  previews: CalendarPost[]
  more: number
  aria: string
}

const cellsView = computed<CellView[]>(() =>
  grid.value.cells.map((c) => {
    const list = props.postsByDay.get(c.date) || []
    return {
      ...c,
      count: list.length,
      previews: list.slice(0, 3),
      more: Math.max(0, list.length - 3),
      aria: `${c.date}, ${list.length} post${list.length === 1 ? '' : 's'}`,
    }
  }),
)

// Expose the computed cells through `weeks` by rebuilding them there.
const weeksView = computed(() => {
  const all = cellsView.value
  const out: CellView[][] = []
  for (let i = 0; i < all.length; i += 7) out.push(all.slice(i, i + 7))
  return out
})

// Rebind: template uses `weeks`, so alias the view model.
const weeksFinal = weeksView
void weeksFinal

const today = todayIso()

function cellClasses(cell: CellView) {
  return {
    'bg-white/[0.03]': cell.date === props.selected,
    'ring-1 ring-inset ring-[var(--eg-accent)]': cell.date === props.selected,
    'opacity-40': cell.adjacent,
    'hover:bg-white/[0.06]': true,
    'cursor-pointer': true,
  }
}

function dayNumberClass(cell: CellView) {
  if (cell.date === today) return 'bg-[var(--eg-accent)] text-black'
  if (cell.date === props.selected) return 'bg-white/15 text-white'
  if (cell.weekday === 0) return 'text-red-300/80'
  return 'text-zinc-300'
}

function shift(delta: number) {
  let m = month.value + delta
  let y = year.value
  while (m < 1) {
    m += 12
    y -= 1
  }
  while (m > 12) {
    m -= 12
    y += 1
  }
  if (y < years.value[0]! || y > years.value[years.value.length - 1]!) {
    toast.info('The planner covers 2024–2032.')
    return
  }
  go(y, m)
}

function go(y: number, m: number) {
  const day = Math.min(parseIsoDay(props.cursor).day, 28)
  const next = toIsoDay(y, m, day)
  year.value = y
  month.value = m
  emitCursor(next)
}

function emitCursor(iso: string) {
  // Parent owns the cursor; mirror local nav through the selected day.
  document.dispatchEvent(new CustomEvent('eg:cursor', { detail: iso }))
}

function goToday() {
  const t = parseIsoDay(today)
  year.value = t.year
  month.value = t.month
  emitCursor(today)
}

function onYear(e: Event) {
  go(Number((e.target as HTMLSelectElement).value), month.value)
}

function onMonth(e: Event) {
  go(year.value, Number((e.target as HTMLSelectElement).value))
}
</script>
