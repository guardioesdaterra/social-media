<template>
  <section class="eg-card overflow-hidden" aria-label="Week calendar">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--eg-border)] px-3 py-2.5 sm:px-4">
      <div class="flex items-center gap-1">
        <button class="eg-btn-ghost !px-2.5 !py-1.5" aria-label="Previous week" @click="shift(-1)">‹</button>
        <button class="eg-btn-ghost !px-2.5 !py-1.5" aria-label="Next week" @click="shift(1)">›</button>
        <button class="eg-btn-ghost !px-3 !py-1.5 text-xs font-medium" @click="goToday">Today</button>
      </div>

      <h1 class="flex-1 text-center text-sm font-semibold text-white sm:text-base">
        {{ weekLabel }}
      </h1>

      <div class="flex items-center gap-1">
        <button
          class="eg-btn-ghost !px-2.5 !py-1.5 text-xs shrink-0"
          @click="$emit('select', selected)"
        >
          Day panel
        </button>
      </div>
    </div>

    <!-- Week grid -->
    <div class="grid grid-cols-7 border-t border-[var(--eg-border)]">
      <div
        v-for="(day, i) in week"
        :key="day"
        class="border-r border-[var(--eg-border)] last:border-r-0 p-2"
        @contextmenu.prevent="onDayContext($event, day)"
        @dragover.prevent="onColDragOver($event, day)"
        @drop="onColDrop($event, day)"
        :class="{ 'ring-2 ring-[var(--eg-accent)]': dragOverCol === day }"
      >
        <div class="flex items-center justify-between mb-2">
          <div>
            <div class="text-[10px] font-semibold uppercase tracking-wider" :class="dowClass(day)">{{ dowShort(day) }}</div>
            <div class="text-xs font-medium" :class="dayClasses(day)">{{ parseIsoDay(day).day }}</div>
          </div>
          <button
            v-if="isSelected(day)"
            class="h-5 w-5 rounded-full bg-[var(--eg-accent)] text-black text-[10px] font-bold"
            aria-label="Today"
          />
        </div>

        <div class="space-y-1.5 min-h-[200px]">
          <div
            v-for="item in itemsFor(day)"
            :key="item.id"
            class="border flex items-start gap-1.5 rounded px-2 py-1.5 text-[10px] cursor-move"
            :style="{ background: itemColor(item) + '12', borderColor: itemColor(item) + '33', opacity: dragSource?.id === item.id ? 0.4 : 1 }"
            draggable="true"
            @dragstart="onItemDragStart($event, item)"
            @dragend="onItemDragEnd"
            @contextmenu.stop.prevent="onItemContext($event, item)"
            @dragover.prevent
            @drop="onItemDrop($event, item, day)"
            :class="{ 'ring-1 ring-[var(--eg-accent)]': dragOver === item.id }"
          >
            <span class="shrink-0 h-3 w-3 rounded-full" :style="{ background: itemColor(item) }" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1 mb-0.5">
                <span class="inline-flex items-center rounded px-1 py-0 text-[8px] font-medium" :style="{ background: itemColor(item) + '20', color: itemColor(item) }">{{ itemKindLabel(item.kind) }}</span>
                <span v-if="item.status" class="inline-flex items-center rounded px-1 py-0 text-[8px] font-medium" :style="{ background: statusColor(item.status) + '20', color: statusColor(item.status) }">{{ statusShort(item.status) }}</span>
              </div>
              <div class="truncate text-zinc-200 leading-tight">{{ item.title || '(no title)' }}</div>
              <span v-if="item.time" class="block mt-0.5 text-[9px] opacity-70">{{ item.time.slice(11, 16) }}</span>
            </div>
            <button
              class="ml-auto shrink-0 eg-btn-ghost !px-1 !py-0.5 text-[9px] text-zinc-400 hover:text-white"
              @click="$emit('edit-item', item)"
            >
              Edit
            </button>
          </div>

          <div v-if="itemsFor(day).length === 0" class="h-4 flex items-center justify-center">
            <span class="text-[9px] text-zinc-600">—</span>
          </div>
        </div>

        <div class="mt-2 flex gap-1">
          <button
            v-if="i > 0"
            class="flex-1 eg-btn-ghost !px-1 !py-1 text-[9px] text-zinc-400 hover:text-white"
            title="Move posts to previous day"
            @click="moveDay(day, -1)"
          >
            ← day
          </button>
          <button
            v-if="i < week.length - 1"
            class="flex-1 eg-btn-ghost !px-1 !py-1 text-[9px] text-zinc-400 hover:text-white"
            title="Move posts to next day"
            @click="moveDay(day, 1)"
          >
            day →
          </button>
          <button
            class="flex-1 eg-btn-ghost !px-1 !py-1 text-[9px] text-zinc-400 hover:text-white"
            @click="$emit('select', day)"
          >
            Panel
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CalendarItem, Topic } from '~/lib/types'
import type { ContextMenuEntry } from '~/composables/useContextMenu'
import {
  parseIsoDay,
  addDays,
  dayLabel,
} from '~/lib/calendar'
import { computed, ref } from 'vue'
import { itemKindColor, itemKindLabel } from '~/lib/types'

const props = defineProps<{
  week: string[]
  itemsByDay: Map<string, CalendarItem[]>
  topics: readonly Topic[]
  selected: string
}>()

const emit = defineEmits<{
  select: [day: string]
  'edit-item': [item: CalendarItem]
  'new-post': [day: string]
  'view-month': [day: string]
  'move-item': [id: string, kind: string, day: string]
}>()

const auth = useSupabaseAuth()
const ctx = useContextMenu()
const { copyText } = useCopyText()
const isManager = computed(() => auth.phase.value === 'manager')

const dragSource = ref<{ id: string; kind: string } | null>(null)
const dragOver = ref<string | null>(null)
const dragOverCol = ref<string | null>(null)

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

const statusColors: Record<string, string> = {
  planned: '#71717a',
  production: '#eab308',
  approved: '#3b82f6',
  published: '#22c55e',
  draft: '#71717a',
  scheduled: '#eab308',
  sent: '#22c55e',
  archived: '#71717a',
}

function statusColor(status: string): string {
  return statusColors[status] ?? '#71717a'
}

function statusShort(status: string): string {
  const map: Record<string, string> = { planned: 'Planned', production: 'Prod.', approved: 'Approved', published: 'Live', draft: 'Draft', scheduled: 'Scheduled', sent: 'Sent', archived: 'Archived' }
  return map[status] ?? status
}

function itemsFor(day: string): CalendarItem[] {
  const list = props.itemsByDay.get(day) || []
  return [...list].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title))
}

function dayPosts(day: string): CalendarItem[] {
  return props.itemsByDay.get(day) || []
}

function dowShort(iso: string): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][parseIsoDay(iso).weekday] ?? 'Sun'
}

function dowClass(iso: string): string {
  const wd = parseIsoDay(iso).weekday
  return wd === 0 ? 'text-red-400/70' : 'text-zinc-500'
}

function dayClasses(iso: string): string {
  const classes = ['text-sm font-medium']
  if (iso === props.selected) classes.push('text-white')
  else classes.push('text-zinc-300')
  return classes.join(' ')
}

function isSelected(iso: string): boolean {
  return iso === props.selected
}

const weekLabel = computed(() => {
  const days = props.week
  if (!days.length) return ''
  const a = parseIsoDay(days[0]!)
  const b = parseIsoDay(days[days.length - 1]!)
  const left = `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][a.month - 1]} ${a.day}`
  const right = a.year === b.year ? `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][b.month - 1]} ${b.day}, ${b.year}` : `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][b.month - 1]} ${b.day}, ${b.year}`
  return `${left} – ${right}`
})

function shift(delta: number) {
  const first = props.week[0]!
  const p = parseIsoDay(first)
  const start = addDays(p.day ? `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}` : first, delta * 7)
  emit('select', start)
}

function goToday() {
  const n = new Date()
  const t = `${String(n.getFullYear()).padStart(4, '0')}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
  emit('select', t)
}

function moveDay(day: string, delta: number) {
  const list = dayPosts(day)
  if (list.length === 0) return
  const target = addDays(day, delta)
  list.forEach((p) => {
    if (p.kind === 'post') emit('edit-item', { ...p, post: { ...p.post, day: target } })
  })
}

/** Drag: item picked up. */
function onItemDragStart(e: DragEvent, item: CalendarItem) {
  dragSource.value = { id: item.id, kind: item.kind }
  e.dataTransfer?.setData('application/json', JSON.stringify({ id: item.id, kind: item.kind, day: item.day }))
  e.dataTransfer!.effectAllowed = 'move'
}

/** Drag: item released. */
function onItemDragEnd() {
  dragSource.value = null
  dragOver.value = null
}

/** Drag: item dropped onto another item → move to that item's day. */
function onItemDrop(e: DragEvent, targetItem: CalendarItem, targetDay: string) {
  e.preventDefault()
  dragOver.value = null
  if (!dragSource.value || dragSource.value.id === targetItem.id) return
  emit('move-item', dragSource.value.id, dragSource.value.kind, targetDay)
  dragSource.value = null
}

/** Drag: over a day column. */
function onColDragOver(e: DragEvent, day: string) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  dragOverCol.value = day
}

/** Drag: dropped onto a day column → move item to that day. */
function onColDrop(_e: DragEvent, day: string) {
  if (!dragSource.value) return
  dragOverCol.value = null
  if (dragSource.value.day === day) return
  emit('move-item', dragSource.value.id, dragSource.value.kind, day)
  dragSource.value = null
}

/** Right-click on a week column → day-level actions. */
function onDayContext(e: MouseEvent, day: string) {
  const items: ContextMenuEntry[] = [{ label: 'Open day', onSelect: () => emit('select', day) }]
  if (isManager.value) {
    items.push({ label: 'New post on this day', onSelect: () => emit('new-post', day) })
  }
  items.push(
    { type: 'separator' },
    { label: 'View month', onSelect: () => emit('view-month', day) },
    { label: 'Go to today', onSelect: () => goToday() },
    { type: 'separator' },
    { label: 'Copy date', onSelect: () => void copyText(dayLabel(day), 'Date copied.') },
    { label: 'Copy ISO date', hint: day, onSelect: () => void copyText(day, 'Date copied.') },
  )
  ctx.openFromEvent(e, items)
}

/** Right-click on a calendar item → item-level actions. */
function onItemContext(e: MouseEvent, item: CalendarItem) {
  const items: ContextMenuEntry[] = [
    { label: `Edit ${itemKindLabel(item.kind)}`, onSelect: () => emit('edit-item', item) },
    { label: 'Copy title', onSelect: () => void copyText(item.title || 'Untitled', 'Title copied.') },
  ]
  items.push(
    { type: 'separator' },
    { label: 'Open day', onSelect: () => emit('select', item.day) },
    { label: 'Copy post date', hint: item.day, onSelect: () => void copyText(item.day, 'Date copied.') },
  )
  ctx.openFromEvent(e, items)
}
</script>
