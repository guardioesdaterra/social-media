<template>
  <div class="relative inline-block">
    <button
      class="eg-btn-glass-red rounded-xl px-3 py-1.5 text-xs shrink-0"
      aria-label="Create event"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click="open = !open"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
      Create
    </button>

    <Transition name="menu">
      <div
        v-if="open"
        class="absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl z-50"
        style="
          background: rgba(20, 20, 22, 0.72);
          backdrop-filter: blur(32px) saturate(160%);
          -webkit-backdrop-filter: blur(32px) saturate(160%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            0 16px 48px rgba(0, 0, 0, 0.5);
        "
        role="menu"
        @click.self="open = false"
      >
        <div class="px-4 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          New event
        </div>
        <div class="p-1.5 space-y-0.5">
          <button
            v-for="item in items"
            :key="item.kind"
            class="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition duration-150 eg-hover-red active:scale-[0.98]"
            role="menuitem"
            @click="select(item.kind)"
          >
            <span
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm transition group-hover:scale-105"
              style="background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.09)"
            >
              {{ item.emoji }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[13px] font-medium text-zinc-200 group-hover:text-white">
                {{ item.label }}
              </span>
              <span class="block truncate text-[11px] text-zinc-500">{{ item.hint }}</span>
            </span>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              class="shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-zinc-400"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </Transition>
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

const items: { kind: CalendarItemKind; emoji: string; label: string; hint: string }[] = [
  { kind: 'post', emoji: '📝', label: 'Post', hint: 'Social post' },
  { kind: 'newsletter', emoji: '✉️', label: 'Newsletter', hint: 'Email newsletter' },
  { kind: 'site_update', emoji: '🌐', label: 'Site update', hint: 'Website page' },
]

function select(kind: CalendarItemKind) {
  open.value = false
  emit('create', kind)
}
</script>

<style scoped>
.menu-enter-active,
.menu-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s cubic-bezier(0.32, 0.72, 0, 1);
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}
</style>
