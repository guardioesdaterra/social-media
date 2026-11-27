<template>
  <div class="flex flex-col h-full min-w-0 border-l border-white/10 bg-[#0a0a0a]">
    <div class="shrink-0 border-b border-white/10 px-6 py-4">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center justify-between">
          <h3 class="text-[13px] font-semibold text-white">Preview</h3>
          <div class="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5">
            <span class="text-[11px] text-zinc-400">Format:</span>
            <span class="text-xs font-medium text-white">{{ form.format }}</span>
          </div>
        </div>
        <button type="button" class="eg-icon-btn text-zinc-400 hover:text-white" aria-label="Hide preview" @click="onHidePreview">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto p-6">
      <div class="mx-auto max-w-[350px] overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl">
        <div class="flex items-center gap-3 px-3 py-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 text-sm font-bold text-black">{{ selectedTopic?.emoji || '📷' }}</div>
          <div class="flex-1 min-w-0">
            <p class="truncate text-[13px] font-semibold text-white">{{ selectedTopic?.label || 'earthguardians' }}</p>
            <p class="truncate text-[11px] text-zinc-500">{{ form.scheduled_at ? `${form.day} at ${form.scheduled_at}` : form.day }}</p>
          </div>
          <button type="button" class="text-zinc-400 hover:text-white transition">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /><circle cx="5" cy="12" r="2" /></svg>
          </button>
        </div>
        <div class="relative aspect-square bg-zinc-900">
          <template v-if="media.preview">
            <template v-if="media.kind === 'video'">
              <video :src="media.preview" alt="Post media" class="h-full w-full object-cover" muted playsinline />
            </template>
            <template v-else>
              <img :src="media.preview" alt="Post media" class="h-full w-full object-cover" />
            </template>
            <div v-if="form.format === 'Reel' || form.format === 'Video'" class="absolute bottom-3 left-3 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 backdrop-blur-sm">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>
              <span class="text-[10px] font-medium text-white">{{ form.format }}</span>
            </div>
            <div v-if="form.format === 'Carousel'" class="absolute bottom-3 left-3 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 backdrop-blur-sm">
              <span class="text-[10px] font-medium text-white">1/3</span>
            </div>
          </template>
          <template v-else>
            <div class="flex h-full flex-col items-center justify-center gap-3 text-zinc-600">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="1.6" /><path d="m21 15-4.2-4.2a2 2 0 0 0-2.8 0L4 21" /></svg>
              <span class="text-xs">No image selected</span>
            </div>
          </template>
        </div>
        <div class="flex items-center justify-between px-3 py-3">
          <div class="flex items-center gap-4">
            <button type="button" class="text-zinc-400 hover:text-white transition">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
            </button>
            <button type="button" class="text-zinc-400 hover:text-white transition">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            </button>
            <button type="button" class="text-zinc-400 hover:text-white transition">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
            </button>
          </div>
          <button type="button" class="text-zinc-400 hover:text-white transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
          </button>
        </div>
        <div class="px-3 pb-1"><p class="text-[13px] font-semibold text-white">1,234 likes</p></div>
        <div class="px-3 py-2">
          <p class="text-[13px] text-white"><span class="font-semibold">{{ selectedTopic?.label || 'earthguardians' }}</span><span class="ml-1">{{ previewCaption }}</span></p>
        </div>
        <div v-if="form.hashtags" class="px-3 pb-3"><p class="text-[13px] text-blue-400">{{ formattedHashtags }}</p></div>
        <div class="px-3 pb-3"><button type="button" class="text-[13px] text-zinc-500 hover:text-zinc-300 transition">View all comments</button></div>
        <div class="border-t border-white/10 px-3 py-2"><p class="text-[10px] uppercase tracking-wider text-zinc-500">{{ formatPreviewDate(form.day) }}</p></div>
      </div>
      <div v-if="form.format === 'Story'" class="mt-6">
        <h4 class="mb-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider">Story Preview</h4>
        <div class="mx-auto aspect-[9/16] max-w-[250px] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">
          <template v-if="media.preview">
            <template v-if="media.kind === 'video'">
              <video :src="media.preview" alt="Story media" class="h-full w-full object-cover" muted playsinline />
            </template>
            <template v-else>
              <img :src="media.preview" alt="Story media" class="h-full w-full object-cover" />
            </template>
            <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <p class="text-sm font-medium text-white truncate">{{ form.title || selectedTopic?.label }}</p>
            </div>
          </template>
          <template v-else>
            <div class="flex h-full flex-col items-center justify-center gap-2 text-zinc-600">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></svg>
              <span class="text-xs">Story content</span>
            </div>
          </template>
        </div>
      </div>
    </div>
    <div class="shrink-0 border-t border-white/10 bg-white/[0.02] px-6 py-3">
      <p class="text-[11px] text-zinc-500"><span class="text-zinc-400">Tip:</span> This is a preview. Actual appearance may vary by platform.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PostFormat, PostStatus, Topic } from '~/lib/types'
import type { MediaState, PostForm } from './types'

const props = defineProps<{
  form: PostForm
  selectedTopic: { emoji: string; label: string } | null
  previewCaption: string
  formattedHashtags: string
  media: MediaState
  formatPreviewDate: (day: string) => string
  onHidePreview: () => void
}>()
</script>
