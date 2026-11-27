<template>
  <div class="flex flex-col h-full min-w-0 border-l border-white/10 bg-[#0a0a0a]">
    <div class="shrink-0 border-b border-white/10 px-6 py-4">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center justify-between">
          <h3 class="text-[13px] font-semibold text-white">Preview</h3>
          <div class="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5">
            <span class="text-[11px] text-zinc-400">Status:</span>
            <span class="text-xs font-medium text-white">{{ statusLabel }}</span>
          </div>
        </div>
        <button type="button" class="eg-icon-btn text-zinc-400 hover:text-white" aria-label="Hide preview" @click="onHidePreview">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto p-6">
      <div class="mx-auto max-w-[700px] overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl">
        <div class="px-6 py-4 border-b border-white/10">
          <h2 class="text-xl font-semibold text-white break-words">{{ form.title }}</h2>
          <p class="mt-1 text-xs text-zinc-500 truncate" :title="form.slug">{{ form.slug }}</p>
          <p class="mt-2 text-[11px] text-zinc-500">
            {{ statusLabel }} · {{ formattedUrl }}
            <span v-if="form.published_at" class="ml-2">· Published {{ formatPublished(form.published_at) }}</span>
          </p>
        </div>
        <div class="px-6 py-6 prose prose-invert max-w-none text-zinc-200" v-html="form.content"></div>
        <div class="border-t border-white/10 px-6 py-3"><p class="text-[11px] text-zinc-500">This is a preview. Actual appearance may vary by browser.</p></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SiteUpdateForm } from './types'
import { computed } from 'vue'

const props = defineProps<{
  form: SiteUpdateForm
  onHidePreview: () => void
}>()

const statusLabel = computed(() => {
  const labels: Record<string, string> = { draft: 'Draft', published: 'Published', archived: 'Archived' }
  return labels[props.form.status ?? 'draft'] ?? props.form.status
})

const formattedUrl = computed(() => props.form.url || '—')

function formatPublished(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>
