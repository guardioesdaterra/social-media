<template>
  <!-- Only the current user's own cursor is visible. Other users' mice are hidden. -->
  <div
    v-if="me"
    class="fixed z-[110] pointer-events-none select-none"
    :style="{ left: me.x + 'px', top: me.y + 'px' }"
  >
    <!-- Own cursor dot -->
    <div
      class="shrink-0 h-3 w-3 rounded-full shadow-lg"
      :style="{ background: '#3b82f6', boxShadow: '0 0 10px #3b82f680' }"
    />
    <!-- Own name label -->
    <div class="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap z-10">
      <span
        class="rounded bg-black/80 backdrop-blur px-1.5 py-0.5 text-[10px] font-medium text-white border border-white/10 shadow-lg"
      >
        {{ me.name }}
      </span>
    </div>
    <!-- Own activity badge -->
    <div v-if="me.activity !== 'idle'" class="absolute -top-14 left-1/2 -translate-x-1/2 whitespace-nowrap z-10">
      <span
        class="rounded bg-[var(--eg-accent)] px-1.5 py-0.5 text-[10px] font-bold text-black shadow-lg animate-pulse"
      >
        {{ activityLabel(me.activity) }}
      </span>
    </div>
    <!-- Click ripple -->
    <div
      v-if="me.activity === 'clicking'"
      class="absolute -top-4 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full border-2 border-[#3b82f6]/60 animate-ping"
      aria-hidden="true"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePresence } from '~/composables/usePresence'

const { me } = usePresence()

function activityLabel(a: string): string {
  const map: Record<string, string> = {
    writing: 'writing…',
    selecting: 'selecting…',
    clicking: 'clicking…',
  }
  return map[a] ?? ''
}
</script>
