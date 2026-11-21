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
        <span class="ml-1 text-sm font-normal text-zinc-500">· {{ monthItemCount }} item{{ monthItemCount === 1 ? '' : 's' }}</span>
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
      <template v-for="(week, wi) in weeksView" :key="wi">
        <button
          v-for="cell in week"
          :key="cell.date"
          type="button"
          class="group relative min-h-[62px] border-b border-r border-[var(--eg-border)] p-1 text-left transition
            last:border-r-0 sm:min-h-[112px] sm:p-1.5"
          :aria-label="cell.aria"
          :aria-pressed="cell.date === selected"
          @click="emit('select', cell.date)"
          @contextmenu.prevent="onDayContext($event, cell)"
          @dragover.prevent="onCellDragOver($event, cell)"
          @drop="onCellDrop($event, cell)"
          :class="{ ...cellClasses(cell), 'ring-2 ring-[var(--eg-accent)]': dragOverCell === cell.date }"
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

          <!-- Item chips (desktop) -->
          <span class="mt-1 hidden flex-col gap-0.5 sm:flex">
            <span
              v-for="item in cell.previews"
              :key="item.id"
              :data-item-id="item.id"
              :data-item-kind="item.kind"
              class="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] leading-tight cursor-pointer cursor-move"
              :style="{ background: itemColor(item) + '26', color: itemColor(item), opacity: dragSource?.id === item.id ? 0.4 : 1 }"
              draggable="true"
              @dragstart="onItemDragStart($event, item)"
              @dragend="onItemDragEnd"
              @click="openItem(item)"
            >
              <span class="h-1.5 w-1.5 shrink-0 rounded-full" :style="{ background: itemColor(item) }" />
              <span class="truncate text-zinc-200">{{ item.title || '(no title)' }}</span>
              <span v-if="item.time" class="ml-auto text-[9px] opacity-70">{{ item.time.slice(11, 16) }}</span>
            </span>
            <span v-if="cell.more > 0" class="px-1 text-[10px] text-zinc-500">+{{ cell.more }} more</span>
          </span>

          <!-- Dots (mobile) -->
          <span class="mt-1 flex flex-wrap gap-0.5 sm:hidden">
            <span
              v-for="item in cell.previews.slice(0, 4)"
              :key="item.id"
              :data-item-kind="item.kind"
              class="h-1.5 w-1.5 rounded-full"
              :style="{ background: itemColor(item) }"
            />
          </span>
        </button>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CalendarItem, Topic } from '~/lib/types'
import type { ContextMenuEntry } from '~/composables/useContextMenu'
import { DOW_FULL, DOW_SHORT, MONTHS, itemKindColor, itemKindLabel } from '~/lib/types'
import { buildMonthGrid, monthLabel, todayIso, parseIsoDay, toIsoDay, dayLabel, daysInMonth } from '~/lib/calendar'
import { computed, reactive, ref, toRefs, watch } from 'vue'

const props = defineProps<{
  cursor: string
  selected: string
  itemsByDay: Map<string, CalendarItem[]>
  topics: readonly Topic[]
}>()

type CalendarMonthEmits = {
  select: [day: string]
  cursor: [iso: string]
  'new-post': [day: string]
  'edit-item': [item: CalendarItem]
  'view-week': [day: string]
  'move-item': [id: string, kind: string, day: string]
}

const emit = defineEmits<CalendarMonthEmits>()

const toast = useToast()
const auth = useSupabaseAuth()
const ctx = useContextMenu()
const { copyText } = useCopyText()
const isManager = computed(() => auth.phase.value === 'manager')

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

const monthItemCount = computed(() => {
  let n = 0
  const itemsByDay = props.itemsByDay || new Map<string, CalendarItem[]>()
  const monthKey = `${String(year.value).padStart(4, '0')}-${String(month.value).padStart(2, '0')}`
  for (const list of itemsByDay.values()) {
    for (const item of list) {
      if (item.day.slice(0, 7) === monthKey) n++
    }
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

function itemColor(item: CalendarItem): string {
  if (item.kind === 'post') return topicColor(item.post.topic_key)
  return itemKindColor(item.kind)
}

interface CellView {
  date: string
  day: number
  weekday: number
  adjacent: boolean
  count: number
  previews: CalendarItem[]
  more: number
  aria: string
}

const cellsView = computed<CellView[]>(() => {
  const itemsByDay = props.itemsByDay || new Map<string, CalendarItem[]>()
  return grid.value.cells.map((c) => {
    const list = itemsByDay.get(c.date) || []
    return {
      ...c,
      count: list.length,
      previews: list.slice(0, 3),
      more: Math.max(0, list.length - 3),
      aria: `${c.date}, ${list.length} item${list.length === 1 ? '' : 's'}`,
    }
  })
})

const weeksView = computed(() => {
  const all = cellsView.value
  const out: CellView[][] = []
  for (let i = 0; i < all.length; i += 7) out.push(all.slice(i, i + 7))
  return out
})

const today = todayIso()

const dragSource = ref<{ id: string; kind: string; day: string } | null>(null)
const dragOverCell = ref<string | null>(null)

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

/** Open the right editor for a calendar item kind. */
function openItem(item: CalendarItem) {
  if (item.kind === 'post') {
    emit('edit-item', item)
    return
  }
  emit('edit-item', item)
}

/** Right-click on a day cell → contextual actions. */
function onDayContext(e: MouseEvent, cell: CellView) {
  const target = e.target as HTMLElement
  const chip = target.closest('[data-item-id]') as HTMLElement | null
  const item = chip
    ? (props.itemsByDay?.get(cell.date) || []).find((i) => i.id === chip.dataset.itemId)
    : null

  if (item) {
    const items: ContextMenuEntry[] = [
      { label: `Edit ${itemKindLabel(item.kind)}`, onSelect: () => emit('edit-item', item) },
      { label: 'Copy title', onSelect: () => void copyText(item.title || 'Untitled', 'Title copied.') },
      { type: 'separator' },
      { label: 'New post on this day', onSelect: () => emit('new-post', cell.date) },
      { label: 'Open day', onSelect: () => emit('select', cell.date) },
      { type: 'separator' },
      { label: 'Copy date', onSelect: () => void copyText(dayLabel(cell.date), 'Date copied.') },
      { label: 'Copy ISO date', hint: cell.date, onSelect: () => void copyText(cell.date, 'Date copied.') },
    ]
    ctx.openFromEvent(e, items)
    return
  }

  const items: ContextMenuEntry[] = [{ label: 'Open day', onSelect: () => emit('select', cell.date) }]
  if (isManager.value) {
    items.push({ label: 'New post on this day', onSelect: () => emit('new-post', cell.date) })
  }
  items.push(
    { type: 'separator' },
    { label: 'View this week', onSelect: () => emit('view-week', cell.date) },
    { label: 'Go to today', onSelect: () => emit('cursor', today) },
    { type: 'separator' },
    { label: 'Copy date', onSelect: () => void copyText(dayLabel(cell.date), 'Date copied.') },
    { label: 'Copy ISO date', hint: cell.date, onSelect: () => void copyText(cell.date, 'Date copied.') },
  )
  ctx.openFromEvent(e, items)
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
  const day = Math.min(parseIsoDay(props.cursor).day, daysInMonth(y, m))
  const next = toIsoDay(y, m, day)
  year.value = y
  month.value = m
  emitCursor(next)
}

function emitCursor(iso: string) {
  emit('cursor', iso)
}

function goToday() {
  const t = parseIsoDay(today)
  year.value = t.year
  month.value = t.month
  emitCursor(today)
}

/** Drag: item chip picked up. */
function onItemDragStart(e: DragEvent, item: CalendarItem) {
  dragSource.value = { id: item.id, kind: item.kind, day: item.day }
  e.dataTransfer?.setData('application/json', JSON.stringify({ id: item.id, kind: item.kind, day: item.day }))
  e.dataTransfer!.effectAllowed = 'move'
}

/** Drag: item chip released. */
function onItemDragEnd() {
  dragSource.value = null
}

/** Drag: over a day cell. */
function onCellDragOver(e: DragEvent, cell: CellView) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  dragOverCell.value = cell.date
}

/** Drag: dropped onto a day cell → move the item. */
function onCellDrop(_e: DragEvent, cell: CellView) {
  if (!dragSource.value) return
  dragOverCell.value = null
  if (dragSource.value.day === cell.date) return
  emit('move-item', dragSource.value.id, dragSource.value.kind, cell.date)
  dragSource.value = null
}

function onYear(e: Event) {
  go(Number((e.target as HTMLSelectElement).value), month.value)
}

function onMonth(e: Event) {
  go(year.value, Number((e.target as HTMLSelectElement).value))
}
</script>
