<template>
  <Teleport to="body">
    <Transition name="pending-bottom">
      <div
        v-if="modelOpen"
        class="fixed inset-x-0 bottom-0 z-[100] flex items-end pointer-events-none pb-4 sm:pb-6"
        @click.self="close"
      >
        <div
          class="pointer-events-auto w-full max-w-4xl flex-col bg-[var(--eg-panel)] border-t border-[var(--eg-border)] shadow-2xl rounded-t-3xl mb-4 transition-transform duration-300 ease-out eg-sheet-enter"
          :class="{ 'translate-y-0': modelOpen, 'translate-y-full': !modelOpen }"
        >
          <!-- Grab handle -->
          <div class="flex justify-center px-4 py-2 shrink-0">
            <div class="w-10 h-1 rounded-full bg-zinc-700" />
          </div>

          <!-- Header -->
          <div class="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--eg-border)] shrink-0 bg-black/40 backdrop-blur-sm">
            <div class="flex items-center gap-2">
              <div class="h-6 w-6 rounded-xl bg-[var(--eg-accent)] flex items-center justify-center text-[10px] font-bold text-black shadow-lg animate-pulse-subtle">
                ✓
              </div>
              <div class="min-w-0">
                <h3 class="text-sm font-semibold text-white truncate">Pending posts</h3>
                <p class="text-[10px] text-zinc-500 truncate">
                  {{ pending.length }} post{{ pending.length === 1 ? '' : 's' }} awaiting review
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="eg-icon-btn shrink-0"
                aria-label="Undo"
                :disabled="!canUndo"
                @click="emit('undo')"
                :title="canUndo ? 'Undo' : ''"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 008 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              <button
                type="button"
                class="eg-icon-btn shrink-0"
                aria-label="Redo"
                :disabled="!canRedo"
                @click="emit('redo')"
                :title="canRedo ? 'Redo' : ''"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 10h-10a8 8 0 01-8 8v2M21 10l-6 6m6-6l-6-6" />
                </svg>
              </button>
              <button
                type="button"
                class="eg-icon-btn shrink-0 text-zinc-400 hover:text-white"
                aria-label="Close pending panel"
                @click="close"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- List -->
          <div class="flex-1 overflow-y-auto p-3 sm:p-4">
            <div v-if="pending.length === 0" class="py-12 text-center">
              <div class="inline-flex flex-col items-center gap-2 text-zinc-500">
                <svg class="h-12 w-12 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <p class="text-xs">No pending posts. Everything is reviewed.</p>
              </div>
            </div>

            <div
              v-for="post in pending"
              :key="post.id"
              class="eg-card p-3.5 relative group transition-all duration-200 hover:eg-card-hover"
              :style="{ borderLeftColor: statusColor(post.status) }"
            >
              <div class="absolute top-3.5 left-3 rounded-full h-2 w-2 transition-colors duration-200" :style="{ background: statusColor(post.status) }" />

              <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      class="inline-flex items-center rounded px-2 py-0.5 text-[9px] font-medium leading-none transition-colors duration-200"
                      :style="{ background: topicColor(post.topic_key) + '15', color: topicColor(post.topic_key) }"
                    >
                      {{ topicEmoji(post.topic_key) }}
                    </span>
                    <span
                      class="inline-flex items-center rounded px-2 py-0.5 text-[9px] font-medium leading-none transition-colors duration-200"
                      :style="{ background: statusColor(post.status) + '15', color: statusColor(post.status) }"
                    >
                      {{ statusLabel(post.status) }}
                    </span>
                    <span v-if="post.scheduled_at" class="ml-auto text-[10px] text-zinc-500">
                      {{ post.scheduled_at.slice(11, 16) }}
                    </span>
                  </div>
                  <h3 class="text-sm font-semibold text-white truncate group-hover:text-[var(--eg-accent)] transition-colors duration-200" :title="post.title">{{ post.title || '(no title)' }}</h3>
                  <p v-if="post.caption" class="mt-1.5 text-xs text-zinc-400 line-clamp-2">{{ post.caption }}</p>
                  <div v-if="post.hashtags" class="mt-2 flex flex-wrap gap-1">
                    <span
                      v-for="tag in (post.hashtags || '').split(/\s+/).filter(Boolean)"
                      :key="tag"
                      class="rounded bg-white/[0.05] px-1.5 py-0 text-[9px] text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-colors duration-150"
                    >
                      #{{ tag }}
                    </span>
                  </div>
                </div>

                <!-- Action buttons -->
                <div class="flex items-center gap-1.5 shrink-0 sm:ml-3">
                  <button
                    type="button"
                    class="eg-btn-glass-red text-xs !px-2.5 !py-1.5 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all duration-150"
                    aria-label="View / Edit post"
                    title="View / Edit"
                    @click="emit('view-edit', post)"
                  >
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View
                  </button>
                  <button
                    type="button"
                    class="eg-btn-glass-red text-xs !px-2.5 !py-1.5 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all duration-150"
                    aria-label="Approve post"
                    title="Approve"
                    :disabled="post.status === 'approved'"
                    @click="emit('approve', post)"
                  >
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m5 13 2 2L19 7" />
                    </svg>
                    Approve
                  </button>
                  <button
                    type="button"
                    class="eg-btn-glass-red text-xs !px-2.5 !py-1.5 hover:text-red-300 hover:bg-red-500/10 transition-all duration-150"
                    aria-label="Decline post"
                    title="Return to planned"
                    :disabled="post.status === 'planned'"
                    @click="emit('decline', post)"
                  >
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Decline
                  </button>
                  <button
                    type="button"
                    class="eg-btn-glass-red text-xs !px-2.5 !py-1.5 hover:text-blue-300 hover:bg-blue-500/10 transition-all duration-150"
                    aria-label="Add comment"
                    title="Comment"
                    @click="emit('comment', post)"
                  >
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Comment
                  </button>
                </div>
              </div>

              <!-- Media preview if exists -->
              <div v-if="post.image_base64 || post.image_slides?.length" class="mt-3 flex gap-1.5 overflow-x-auto pb-1">
                <img
                  v-for="(slide, idx) in (post.image_slides?.filter((s): s is string => !!s).length ? post.image_slides.filter((s): s is string => !!s) : (post.image_base64 ? [post.image_base64] : []))"
                  :key="idx"
                  :src="slide"
                  alt=""
                  class="h-16 w-auto rounded-lg flex-shrink-0 object-cover transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div v-else-if="post.video_base64" class="mt-3">
                <video class="h-16 w-auto rounded-lg" muted playsinline>
                  <source :src="post.video_base64" type="video/mp4" />
                </video>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="border-t border-[var(--eg-border)] px-5 py-3 shrink-0 bg-black/40 backdrop-blur-sm">
            <p class="text-[10px] text-zinc-600 text-center">
              Approve/decline/comment are atomic actions — use undo/redo to step back without breaking anything.
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CalendarPost } from '~/lib/types'
import { statusLabel } from '~/lib/types'

const props = defineProps<{
  posts: readonly CalendarPost[]
  open?: boolean
  canUndo?: boolean
  canRedo?: boolean
}>()

const emit = defineEmits<{
  close: []
  approve: [post: CalendarPost]
  decline: [post: CalendarPost]
  comment: [post: CalendarPost]
  'view-edit': [post: CalendarPost]
  undo: []
  redo: []
}>()

const modelOpen = computed({
  get: () => props.open ?? false,
  set: (v) => { if (!v) emit('close') },
})

function close() {
  emit('close')
}

const pending = computed(() => props.posts.filter((p) => p.status === 'planned' || p.status === 'production'))

const statusColors: Record<string, string> = {
  planned: '#71717a',
  production: '#eab308',
  approved: '#3b82f6',
  published: '#22c55e',
  draft: '#71717a',
}

function statusColor(status: string): string {
  return statusColors[status] ?? '#71717a'
}

const topicColors: Record<string, string> = {
  'climate-action': '#E8492B',
  'fundraising-mobilizing': '#F97316',
  'impact-restoration': '#14B8A6',
  'awareness-days': '#EAB308',
  'crews-community': '#22C55E',
}

const topicEmojis: Record<string, string> = {
  'climate-action': '🌍',
  'fundraising-mobilizing': '💖',
  'impact-restoration': '🌳',
  'awareness-days': '📅',
  'crews-community': '👥',
} as const

function topicColor(key: string): string {
  return topicColors[key] ?? '#71717a'
}

function topicEmoji(key: string): string {
  return topicEmojis[key as keyof typeof topicEmojis] ?? '•'
}
</script>
