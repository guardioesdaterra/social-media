<template>
  <div
    v-for="u in users"
    :key="u.id"
    class="fixed z-[110] pointer-events-none select-none"
    :style="{
      left: u.x + 'px',
      top: u.y + 'px',
    }"
  >
    <!-- Cursor dot -->
    <div
      class="shrink-0 h-3 w-3 rounded-full shadow-lg"
      :style="{ background: cursorColor(u.id), boxShadow: '0 0 10px ' + cursorColor(u.id) + '80' }"
    />
    <!-- Name label -->
    <div class="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap z-10">
      <span
        class="rounded bg-black/80 backdrop-blur px-1.5 py-0.5 text-[10px] font-medium text-white border border-white/10 shadow-lg"
      >
        {{ u.name }}
      </span>
    </div>
    <!-- Activity badge -->
    <div v-if="u.activity !== 'idle'" class="absolute -top-14 left-1/2 -translate-x-1/2 whitespace-nowrap z-10">
      <span
        class="rounded bg-[var(--eg-accent)] px-1.5 py-0.5 text-[10px] font-bold text-black shadow-lg animate-pulse"
      >
        {{ activityLabel(u.activity) }}
      </span>
    </div>
    <!-- Click ripple (shown briefly when clicking) -->
    <div
      v-if="u.activity === 'clicking'"
      class="absolute -top-4 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full border-2 border-[var(--eg-accent)]/60 animate-ping"
      aria-hidden="true"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePresence } from '~/composables/usePresence'

const { users } = usePresence()

const hue = computed(() => {
  const seeds: Record<string, number> = {}
  let n = 0
  return (id: string): string => {
    if (seeds[id] === undefined) seeds[id] = (n * 137.508) % 360
    return `hsl(${seeds[id]}, 70%, 55%)`
  }
})

function cursorColor(id: string): string {
  return hue.value(id)
}

function activityLabel(a: string): string {
  const map: Record<string, string> = {
    writing: 'writing…',
    selecting: 'selecting…',
    clicking: 'clicking…',
  }
  return map[a] ?? ''
}
</script>
