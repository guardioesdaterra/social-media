<template>
  <div class="space-y-3" @contextmenu.prevent="onPanelContext">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
        {{ dayTitle }} <span class="ml-1 text-[11px] font-normal text-zinc-600">{{ postCount }} post{{ postCount === 1 ? '' : 's' }}</span>
      </h2>
      <button
        v-if="canEdit"
        class="eg-btn-ghost !px-2.5 !py-1.5 text-xs shrink-0"
        aria-label="Add post"
        @click="emit('add')"
      >
        + Add
      </button>
    </div>

    <div v-if="posts.length === 0" class="rounded-xl border border-[var(--eg-border)] bg-white/[0.02] p-4 text-center">
      <p class="text-xs text-zinc-500">No posts scheduled for this day.</p>
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
        v-for="p in posts"
        :key="p.id"
        class="eg-card p-3 relative group"
        @contextmenu.stop.prevent="onPostContext($event, p)"
      >
        <div class="flex items-start gap-2">
          <span
            class="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
            :style="{ background: topicColor(p.topic_key) + '20', color: topicColor(p.topic_key) }"
          >
            {{ topicEmoji(p.topic_key) }}
          </span>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 mb-1">
              <span
                class="inline-flex items-center rounded px-1 py-0 text-[9px] font-medium leading-none"
                :style="{ background: formatColor(p.format) + '15', color: formatColor(p.format) }"
              >
                {{ p.format }}
              </span>
              <span
                class="inline-flex items-center rounded px-1 py-0 text-[9px] font-medium leading-none"
                :style="{ background: statusColor(p.status) + '15', color: statusColor(p.status) }"
              >
                {{ statusLabel(p.status) }}
              </span>
              <span class="ml-auto text-[10px] text-zinc-500 truncate max-w-[30%]">{{ p.sort_order }}</span>
            </div>

            <h3 class="text-sm font-semibold text-white truncate" :title="p.title">{{ p.title || '(no title)' }}</h3>

            <p v-if="p.caption" class="mt-1 text-xs text-zinc-400 line-clamp-2">{{ p.caption }}</p>

            <div v-if="p.hashtags" class="mt-2 flex flex-wrap gap-1">
              <span
                v-for="tag in p.hashtags.split(/\s+/).filter(Boolean)"
                :key="tag"
                class="rounded bg-white/[0.05] px-1 py-0 text-[9px] text-zinc-300"
              >
                #{{ tag }}
              </span>
            </div>

            <div v-if="p.image_base64" class="mt-2 flex items-center gap-2">
              <img
                :src="p.image_base64"
                alt=""
                class="h-12 w-16 rounded object-cover border border-[var(--eg-border)]"
              />
              <button
                class="ml-auto eg-btn-ghost !px-1.5 !py-1 text-[10px] text-red-400 hover:text-red-300"
                title="Remove image"
                @click.stop="removeImage(p.id)"
              >
                ✕
              </button>
              <button
                class="eg-btn-ghost !px-1.5 !py-1 text-[10px] text-zinc-400 hover:text-zinc-200"
                title="Download full quality"
                @click.stop="downloadImage(p.id)"
              >
                ⤓
              </button>
            </div>

            <div class="mt-2.5 flex items-center gap-2">
              <button
                class="flex-1 eg-btn-ghost !px-2 !py-1.5 text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                @click="emit('edit', p)"
              >
                Edit
              </button>
              <button
                class="eg-btn-ghost !px-2 !py-1.5 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10"
                @click="confirmDelete(p.id)"
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
import type { CalendarPost, Topic } from '~/lib/types'
import type { ContextMenuEntry } from '~/composables/useContextMenu'
import { dayLabel } from '~/lib/calendar'
import { statusLabel } from '~/lib/types'
import { computed } from 'vue'
import { useSupabaseAuth } from '~/composables/useSupabaseAuth'

const props = defineProps<{
  day: string
  posts: CalendarPost[]
  topics: readonly Topic[]
}>()

const emit = defineEmits<{
  add: []
  edit: [post: CalendarPost]
  delete: [id: string]
  save: [draft: any]
}>()

const { phase } = useSupabaseAuth()
const canEdit = computed(() => phase.value === 'manager')

const ctx = useContextMenu()
const { copyText } = useCopyText()

const dayTitle = computed(() => dayLabel(props.day))
const postCount = computed(() => props.posts.length)

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

const formatColors: Record<string, string> = {
  Carousel: '#3b82f6',
  Photo: '#22c55e',
  Reel: '#ec4899',
  Story: '#a855f7',
  Video: '#f59e0b',
}

function formatColor(format: string): string {
  return formatColors[format] ?? '#71717a'
}

const statusColors: Record<string, string> = {
  planned: '#71717a',
  production: '#eab308',
  approved: '#3b82f6',
  published: '#22c55e',
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

/** Right-click on a post card → post-level actions. */
function onPostContext(e: MouseEvent, p: CalendarPost) {
  const items: ContextMenuEntry[] = [
    { label: 'Edit post', onSelect: () => emit('edit', p) },
    { label: 'Copy title', onSelect: () => void copyText(p.title || 'Untitled', 'Title copied.') },
  ]
  if (p.caption) {
    items.push({ label: 'Copy caption', onSelect: () => void copyText(p.caption, 'Caption copied.') })
  }
  if (p.hashtags) {
    items.push({ label: 'Copy hashtags', onSelect: () => void copyText(p.hashtags, 'Hashtags copied.') })
  }
  items.push(
    { type: 'separator' },
    { label: 'Copy post date', hint: p.day, onSelect: () => void copyText(p.day, 'Date copied.') },
  )
  if (canEdit.value) {
    items.push({ type: 'separator' }, { label: 'Delete post', danger: true, onSelect: () => confirmDelete(p.id) })
  }
  ctx.openFromEvent(e, items)
}

async function removeImage(id: string) {
  const post = props.posts.find((p) => p.id === id)
  if (!post) return
  if (window.confirm('Remove the image from this post?')) {
    emit('save', { id, day: post.day, topic_key: post.topic_key, image_base64: null })
  }
}

async function downloadImage(id: string) {
  const post = props.posts.find((p) => p.id === id)
  if (!post?.image_base64) return
  const { downloadDataUrl, slugify } = await import('~/lib/image')
  downloadDataUrl(post.image_base64, slugify(`${post.day}_${post.topic_key}`) + '.' + (post.image_mime?.split('/')[1] || 'jpg'))
}
</script>
