<template>
  <div class="relative inline-block">
    <button
      class="eg-btn-ghost !px-2.5 !py-1.5 text-xs shrink-0"
      aria-label="Create event"
      @click="open = !open"
    >
      <span class="flex items-center gap-1">+ Create</span>
    </button>

    <div
      v-if="open"
      class="absolute left-0 mt-1 w-48 bg-[var(--eg-panel)] border border-[var(--eg-border)] rounded-xl shadow-2xl z-50"
      @click.self="open = false"
    >
      <div class="px-2 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
        New event
      </div>
      <div class="divide-y divide-[var(--eg-border)]/30">
        <button
          class="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition"
          @click="select('post')"
        >
          <span class="text-sm">📝</span>
          <span>Post</span>
          <span class="ml-auto text-[10px] text-zinc-500">Social post</span>
        </button>
        <button
          class="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition"
          @click="select('newsletter')"
        >
          <span class="text-sm">✉️</span>
          <span>Newsletter</span>
          <span class="ml-auto text-[10px] text-zinc-500">Email newsletter</span>
        </button>
        <button
          class="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition"
          @click="select('site_update')"
        >
          <span class="text-sm">🌐</span>
          <span>Site update</span>
          <span class="ml-auto text-[10px] text-zinc-500">Website page</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CalendarItemKind } from '~/lib/types'

const props = defineProps<{
  day: string
}>()

const emit = defineEmits<{
  'create': [kind: CalendarItemKind]
}>()

const open = defineModel<boolean>()

function select(kind: CalendarItemKind) {
  open.value = false
  emit('create', kind)
}
</script>
