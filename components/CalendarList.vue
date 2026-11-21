<template>
  <section class="eg-card overflow-hidden" aria-label="Calendar list">
    <div class="overflow-y-auto">
      <div v-for="(day, di) in groupedDays" :key="day" class="mb-4">
        <div class="flex items-center gap-2 px-3 py-2 border-b border-[var(--eg-border)] bg-white/[0.02]">
          <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            {{ dayLabel(day) }}
          </span>
          <span class="ml-auto text-[10px] text-zinc-500">
            {{ itemsByDay.get(day)?.length || 0 }} item{{ itemsByDay.get(day)?.length === 1 ? '' : 's' }}
          </span>
        </div>

        <div class="divide-y divide-[var(--eg-border)]/30">
          <div
            v-for="item in itemsFor(day)"
            :key="item.id"
            class="flex items-start gap-2 px-3 py-2.5 cursor-move transition hover:bg-white/[0.02]"
            draggable="true"
            @dragstart="onDragStart($event, item)"
            @dragend="onDragEnd"
            @dragover.prevent
            @drop="onDrop($event, item, day)"
            :class="{ 'bg-white/[0.03]': dragOver === item.id }"
          >
            <!-- Kind color dot -->
            <span
              class="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
              :style="{ background: itemColor(item) + '20', color: itemColor(item) }"
            >
              {{ item.kind === 'post' ? topicEmoji(item.post.topic_key) : kindIcon(item.kind) }}
            </span>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 mb-1">
                <span
                  class="inline-flex items-center rounded px-1 py-0 text-[9px] font-medium leading-none"
                  :style="{ background: itemColor(item) + '15', color: itemColor(item) }"
                >
                  {{ itemKindLabel(item.kind) }}
                </span>
                <span v-if="item.status" class="inline-flex items-center rounded px-1 py-0 text-[9px] font-medium leading-none" :style="{ background: statusColor(item.status) + '15', color: statusColor(item.status) }">
                  {{ itemStatusLabel(item.status) }}
                </span>
                <span v-if="item.time" class="ml-auto text-[10px] text-zinc-500">{{ item.time.slice(11, 16) }}</span>
              </div>

              <h3 class="text-sm font-semibold text-white truncate" :title="item.title">{{ item.title || '(no title)' }}</h3>

              <!-- Post-specific body -->
              <div v-if="item.kind === 'post'" class="mt-1">
                <p v-if="postOf(item)?.caption" class="text-xs text-zinc-400 line-clamp-2">{{ postOf(item)?.caption }}</p>
                <div v-if="postOf(item)?.hashtags" class="mt-1 flex flex-wrap gap-1">
                  <span
                    v-for="tag in (postOf(item)?.hashtags || '').split(/\s+/).filter(Boolean)"
                    :key="tag"
                    class="rounded bg-white/[0.05] px-1 py-0 text-[9px] text-zinc-300"
                  >
                    #{{ tag }}
                  </span>
                </div>
              </div>

              <!-- Newsletter-specific body -->
              <div v-else-if="item.kind === 'newsletter'" class="mt-1">
                <p v-if="item.newsletter.subject" class="text-xs text-zinc-400 line-clamp-1">{{ item.newsletter.subject }}</p>
              </div>

              <!-- Site update-specific body -->
              <div v-else-if="item.kind === 'site_update'" class="mt-1">
                <p v-if="item.site_update.slug" class="text-[10px] text-zinc-500">{{ item.site_update.slug }}</p>
                <p v-if="item.site_update.url" class="text-[10px] text-zinc-500">{{ item.site_update.url }}</p>
              </div>
            </div>

            <button
              class="eg-btn-ghost !px-2 !py-1.5 text-[10px] text-zinc-400 hover:text-white"
              @click="$emit('edit-item', item)"
            >
              Edit
            </button>
          </div>

          <div v-if="itemsFor(day).length === 0" class="px-3 py-2 text-center">
            <span class="text-[9px] text-zinc-600">—</span>
          </div>
        </div>
      </div>

      <div v-if="groupedDays.length === 0" class="px-3 py-12 text-center">
        <p class="text-xs text-zinc-500">No items scheduled.</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CalendarItem, CalendarItemPost, PostStatus, Topic } from '~/lib/types'
import { dayLabel } from '~/lib/calendar'
import { computed, ref } from 'vue'
import { itemKindColor, itemKindLabel, statusLabel } from '~/lib/types'
import { useSupabaseAuth } from '~/composables/useSupabaseAuth'

const props = defineProps<{
  itemsByDay: Map<string, CalendarItem[]>
  topics: readonly Topic[]
  selected: string
}>()

const emit = defineEmits<{
  select: [day: string]
  'edit-item': [item: CalendarItem]
  'move-item': [id: string, kind: string, day: string]
}>()

const auth = useSupabaseAuth()
const isManager = computed(() => auth.phase.value === 'manager')

const topicMap = computed(() => {
  const m = new Map<string, Topic>()
  for (const t of props.topics) m.set(t.key, t)
  return m
})

function topicColor(key: string): string {
  return topicMap.value.get(key)?.color || '#71717a'
}

function topicEmoji(key: string): string {
  return topicMap.value.get(key)?.emoji || '•'
}

function kindIcon(kind: string): string {
  const map: Record<string, string> = { newsletter: '✉', site_update: '🌐', post: '•' }
  return map[kind] || '•'
}

function itemColor(item: CalendarItem): string {
  if (item.kind === 'post') return topicColor(item.post.topic_key)
  return itemKindColor(item.kind)
}

function itemStatusLabel(status: string | null): string {
  return status ? statusLabel(status as PostStatus) : ''
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

function postOf(item: CalendarItem): CalendarItemPost | null {
  return item.kind === 'post' ? (item as unknown as CalendarItemPost) : null
}

const dragSource = ref<{ id: string; kind: string } | null>(null)
const dragOver = ref<string | null>(null)

const groupedDays = computed(() => {
  const days = new Set<string>()
  for (const day of props.itemsByDay.keys()) days.add(day)
  return [...days].sort()
})

function itemsFor(day: string): CalendarItem[] {
  return (props.itemsByDay.get(day) || []).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title))
}

function onDragStart(e: DragEvent, item: CalendarItem) {
  dragSource.value = { id: item.id, kind: item.kind }
  dragOver.value = item.id
  e.dataTransfer?.setData('application/json', JSON.stringify({ id: item.id, kind: item.kind, day: item.day }))
  e.dataTransfer!.effectAllowed = 'move'
  // Slight opacity fade for the source row
  ;(e.target as HTMLElement).style.opacity = '0.4'
}

function onDragEnd(e: DragEvent) {
  ;(e.target as HTMLElement).style.opacity = ''
  dragSource.value = null
  dragOver.value = null
}

function onDrop(e: DragEvent, targetItem: CalendarItem, targetDay: string) {
  e.preventDefault()
  dragOver.value = null

  try {
    const data = e.dataTransfer?.getData('application/json')
    if (!data) return
    const payload = JSON.parse(data) as { id: string; kind: string; day: string }
    if (payload.id === targetItem.id && payload.day === targetDay) return

    emit('move-item', payload.id, payload.kind, targetDay)
  } catch {
    // ignore malformed drag data
  }
}
</script>
