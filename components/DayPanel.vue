<template>
  <div class="space-y-3" @contextmenu.prevent="onPanelContext">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
        {{ dayTitle }} <span class="ml-1 text-[11px] font-normal text-zinc-600">{{ itemCount }} item{{ itemCount === 1 ? '' : 's' }}</span>
      </h2>
      <button
        v-if="canEdit"
        class="eg-btn-ghost !px-2.5 !py-1.5 text-xs shrink-0"
        aria-label="Add post"
        @click="emit('add')"
      >
        + Add post
      </button>
    </div>

    <div v-if="items.length === 0" class="rounded-xl border border-[var(--eg-border)] bg-white/[0.02] p-4 text-center">
      <p class="text-xs text-zinc-500">No items scheduled for this day.</p>
      <button
        v-if="canEdit"
        class="mt-3 eg-btn-ghost !px-3 !py-1.5 text-xs"
        @click="emit('add')"
      >
        Create a post
      </button>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="item in items"
        :key="item.id"
        class="eg-card p-3 relative group cursor-move"
        :style="{ opacity: dragSource?.id === item.id ? 0.4 : 1 }"
        draggable="true"
        @dragstart="onItemDragStart($event, item)"
        @dragend="onItemDragEnd"
        @contextmenu.stop.prevent="onItemContext($event, item)"
        @dragover.prevent
        @drop="onItemDrop($event, item)"
        :class="{ 'ring-1 ring-[var(--eg-accent)]': dragOver === item.id }"
      >
        <div class="flex items-start gap-2">
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
              <span v-if="item.time" class="ml-auto text-[10px] text-zinc-500 truncate max-w-[30%]">{{ item.time.slice(11, 16) }}</span>
              <span v-if="!item.time && item.kind === 'post'" class="ml-auto text-[10px] text-zinc-500">All day</span>
            </div>

            <h3 class="text-sm font-semibold text-white truncate" :title="item.title">{{ item.title || '(no title)' }}</h3>

            <!-- Post-specific body -->
            <div v-if="item.kind === 'post'">
              <p v-if="postOf(item)?.caption" class="mt-1 text-xs text-zinc-400 line-clamp-2">{{ postOf(item)?.caption }}</p>
              <div v-if="postOf(item)?.hashtags" class="mt-2 flex flex-wrap gap-1">
                <span
                  v-for="tag in (postOf(item)?.hashtags || '').split(/\s+/).filter(Boolean)"
                  :key="tag"
                  class="rounded bg-white/[0.05] px-1 py-0 text-[9px] text-zinc-300"
                >
                  #{{ tag }}
                </span>
              </div>
              <div v-if="postOf(item)?.image_base64" class="mt-2 flex items-center gap-2">
                <img
                  :src="postOf(item)?.image_base64 ?? undefined"
                  alt=""
                  class="h-12 w-16 rounded object-cover border border-[var(--eg-border)]"
                />
                <button
                  class="ml-auto eg-btn-ghost !px-1.5 !py-1 text-[10px] text-red-400 hover:text-red-300"
                  title="Remove image"
                  @click.stop="removeImage(postOf(item)?.id)"
                >
                  ✕
                </button>
                <button
                  class="eg-btn-ghost !px-1.5 !py-1 text-[10px] text-zinc-400 hover:text-zinc-200"
                  title="Download full quality"
                  @click.stop="downloadImage(postOf(item)?.id)"
                >
                  ⤓
                </button>
              </div>
            </div>

            <!-- Newsletter-specific body -->
            <div v-else-if="item.kind === 'newsletter'">
              <p v-if="item.newsletter.subject" class="mt-1 text-xs text-zinc-400 line-clamp-2">{{ item.newsletter.subject }}</p>
              <p v-if="item.newsletter.recipient_list" class="mt-1 text-[10px] text-zinc-500">{{ item.newsletter.recipient_list }}</p>
            </div>

            <!-- Site update-specific body -->
            <div v-else-if="item.kind === 'site_update'">
              <p v-if="item.site_update.slug" class="mt-1 text-[10px] text-zinc-500">{{ item.site_update.slug }}</p>
              <p v-if="item.site_update.url" class="mt-1 text-[10px] text-zinc-500">{{ item.site_update.url }}</p>
            </div>

            <div class="mt-2.5 flex items-center gap-2">
              <button
                class="flex-1 eg-btn-ghost !px-2 !py-1.5 text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                @click="emit('edit-item', item)"
              >
                Edit
              </button>
              <button
                v-if="canEdit && item.kind === 'post'"
                class="eg-btn-ghost !px-2 !py-1.5 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10"
                @click="confirmDelete(item.post.id)"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CalendarItem, CalendarItemPost, CalendarPost, PostStatus, Topic } from '~/lib/types'
import type { ContextMenuEntry } from '~/composables/useContextMenu'
import { dayLabel } from '~/lib/calendar'
import { statusLabel } from '~/lib/types'
import { computed, ref } from 'vue'
import { useSupabaseAuth } from '~/composables/useSupabaseAuth'
import { itemKindColor, itemKindLabel } from '~/lib/types'

const props = defineProps<{
  day: string
  items: CalendarItem[]
  topics: readonly Topic[]
}>()

const emit = defineEmits<{
  add: []
  'edit-item': [item: CalendarItem]
  delete: [id: string]
  save: [draft: any]
  'move-item': [id: string, kind: string, day: string]
}>()

const { phase } = useSupabaseAuth()
const canEdit = computed(() => phase.value === 'manager')

const dragSource = ref<{ id: string; kind: string } | null>(null)
const dragOver = ref<string | null>(null)

const ctx = useContextMenu()
const { copyText } = useCopyText()

const dayTitle = computed(() => dayLabel(props.day))
const itemCount = computed(() => props.items.length)

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

function postOf(item: CalendarItem): CalendarPost | null {
  return item.kind === 'post' ? item.post : null
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

async function confirmDelete(id: string) {
  if (window.confirm('Delete this post?')) {
    emit('delete', id)
  }
}

/** Right-click on the panel background → day-level actions. */
function onPanelContext(e: MouseEvent) {
  const items: ContextMenuEntry[] = []
  if (canEdit.value) {
    items.push({ label: 'Add post to this day', onSelect: () => emit('add') })
    items.push({ type: 'separator' })
  }
  items.push(
    { label: 'Copy date', onSelect: () => void copyText(dayLabel(props.day), 'Date copied.') },
    { label: 'Copy ISO date', hint: props.day, onSelect: () => void copyText(props.day, 'Date copied.') },
  )
  ctx.openFromEvent(e, items)
}

/** Right-click on a calendar item card → item-level actions. */
function onItemContext(e: MouseEvent, item: CalendarItem) {
  const items: ContextMenuEntry[] = [
    { label: `Edit ${itemKindLabel(item.kind)}`, onSelect: () => emit('edit-item', item) },
    { label: 'Copy title', onSelect: () => void copyText(item.title || 'Untitled', 'Title copied.') },
  ]
  if (item.kind === 'newsletter' && item.newsletter.subject) {
    items.push({ label: 'Copy subject', onSelect: () => void copyText(item.newsletter.subject, 'Subject copied.') })
  }
  if (item.kind === 'site_update' && item.site_update.url) {
    items.push({ label: 'Copy URL', onSelect: () => void copyText(item.site_update.url || '', 'URL copied.') })
  }
  items.push(
    { type: 'separator' },
    { label: 'Copy item date', hint: item.day, onSelect: () => void copyText(item.day, 'Date copied.') },
  )
  if (canEdit.value && item.kind === 'post') {
    items.push({ type: 'separator' }, { label: 'Delete post', danger: true, onSelect: () => confirmDelete(item.post.id) })
  }
  ctx.openFromEvent(e, items)
}

async function removeImage(id: string | undefined) {
  if (!id) return
  const item = props.items.find((i): i is CalendarItemPost => i.kind === 'post' && i.post.id === id)
  if (!item) return
  if (window.confirm('Remove the image from this post?')) {
    emit('save', { id, day: item.post.day, topic_key: item.post.topic_key, image_base64: null })
  }
}

async function downloadImage(id: string | undefined) {
  if (!id) return
  const item = props.items.find((i): i is CalendarItemPost => i.kind === 'post' && i.post.id === id)
  if (!item?.post.image_base64) return
  const { downloadDataUrl, slugify } = await import('~/lib/image')
  downloadDataUrl(item.post.image_base64, slugify(`${item.post.day}_${item.post.topic_key}`) + '.' + (item.post.image_mime?.split('/')[1] || 'jpg'))
}
</script>
