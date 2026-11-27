<template>
  <section class="eg-section">
    <div class="flex items-center gap-2">
      <h3 class="eg-section-title">Media</h3>
      <span class="ml-auto flex h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
    </div>
    <p class="eg-section-sub">Full quality image or video, stored in Postgres.</p>
    <div class="mt-4 space-y-3">
      <div class="eg-segmented mt-2" role="tablist" aria-label="Media source">
        <button
          type="button"
          role="tab"
          :aria-selected="mediaSource === 'local'"
          class="eg-segmented-item"
          :class="{ 'is-active': mediaSource === 'local' }"
          @click="emit('update:mediaSource', 'local')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1.5">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8" />
            <path d="M12 17v4" />
          </svg>
          Local Upload
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="mediaSource === 'gdrive'"
          class="eg-segmented-item"
          :class="{ 'is-active': mediaSource === 'gdrive' }"
          @click="emit('update:mediaSource', 'gdrive')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="mr-1.5">
            <path d="M19.5 9c0-2.48-2.02-4.5-4.5-4.5S10.5 6.52 10.5 9" />
            <path d="M12 16.5c-2.48 0-4.5-2.02-4.5-4.5S9.5 7.5 12 7.5s4.5 2.02 4.5 4.5" />
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="M21 15h-2.5a1.5 1.5 0 0 1-1.5-1.5V12a1.5 1.5 0 0 0-1.5-1.5H12" />
          </svg>
          Google Drive
        </button>
      </div>

      <div v-if="mediaSource === 'local'" class="mt-2 space-y-3">
        <label class="eg-dropzone">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="text-zinc-500">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="9" cy="9" r="1.6" />
            <path d="m21 15-4.2-4.2a2 2 0 0 0-2.8 0L4 21" />
          </svg>
          <span class="text-sm font-medium text-zinc-300">Click to choose an image or video</span>
          <span class="text-[11px] text-zinc-500">PNG, JPG or WebP (max 4 MB) · MP4 or MOV (max 100 MB) · replaces any existing media</span>
          <input type="file" accept="image/*,video/*" class="sr-only" @change="onMedia" />
        </label>
      </div>

      <div v-else class="mt-2">
        <div class="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-3.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="mt-0.5 flex-shrink-0 text-emerald-400">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-white">Pick from Google Drive</p>
            <p class="mt-0.5 text-xs text-zinc-400">Choose one file, several files — or a whole folder (every image and video inside it) when the format is Carousel.</p>
          </div>
        </div>
        <button type="button" class="eg-btn-apple-secondary mt-3 w-full" @click="openGdrive">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0" aria-hidden="true">
            <path d="M21 15V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v10" />
            <path d="M3 15v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V15" />
          </svg>
          Open Google Drive
        </button>
        <p class="eg-hint">Files are downloaded from your Drive and stored with the post.</p>
      </div>

      <div v-if="media.preview" class="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
        <template v-if="media.kind === 'video'">
          <video :src="media.preview" alt="" class="h-16 w-24 shrink-0 rounded-lg object-cover ring-1 ring-white/10" muted playsinline />
        </template>
        <template v-else>
          <img :src="media.preview" alt="" class="h-16 w-24 shrink-0 rounded-lg object-cover ring-1 ring-white/10" />
        </template>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <p class="truncate text-xs font-medium text-zinc-200" :title="media.name || undefined">{{ media.name || `Current ${media.kind}` }}</p>
            <span v-if="media.origin" class="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide" :class="media.origin === 'gdrive' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-zinc-400'">{{ media.origin === 'gdrive' ? 'Google Drive' : 'Upload' }}</span>
          </div>
          <p class="mt-0.5 text-[11px] text-zinc-500">{{ media.kind === 'video' ? 'Video' : 'Image' }} · {{ formatBytes(media.bytes) }}</p>
        </div>
        <button type="button" class="eg-btn-apple-secondary rounded-lg px-3 py-1.5 text-xs" @click="onDownloadMedia">⤓ Download</button>
        <button type="button" class="eg-icon-btn text-red-400" aria-label="Remove media" @click="onClearMedia">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { MediaSource, MediaState, PostForm } from './types'
import { formatBytes } from '~/lib/image'

const props = defineProps<{
  form: PostForm
  mediaSource: MediaSource
  media: MediaState
  onMedia: (event: Event) => void
  onClearMedia: () => void
  onDownloadMedia: () => void
  openGdrive: () => void
}>()

const emit = defineEmits<{ 'update:mediaSource': [source: MediaSource] }>()
</script>
