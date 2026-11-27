<template>
  <Teleport to="body">
    <div
      v-if="onlineCount > 0"
      class="fixed top-4 left-4 z-[120] flex flex-col gap-2 pointer-events-none"
    >
      <div
        v-for="u in users"
        :key="u.id"
        class="pointer-events-auto flex items-center gap-2.5 rounded-lg border border-[var(--eg-border)] bg-black/70 backdrop-blur-md px-2.5 py-1.5 text-xs shadow-lg transition hover:bg-black/80"
        :class="{ 'ring-1 ring-[var(--eg-accent)]': u.activity !== 'idle' }"
      >
        <img
          :src="u.avatar"
          :alt="u.name"
          class="h-6 w-6 rounded-full border border-white/10 object-cover shrink-0"
        />
        <span class="shrink-0 truncate max-w-[150px] text-white">{{ u.name }}</span>
        <span
          v-if="u.activity !== 'idle'"
          class="ml-auto shrink-0 rounded bg-[var(--eg-accent)]/20 px-1.5 py-0.5 text-[10px] font-medium text-[var(--eg-accent)] whitespace-nowrap animate-pulse"
        >
          {{ activityLabel(u.activity) }}
        </span>
        <span v-else class="ml-auto shrink-0 text-[10px] text-zinc-500 whitespace-nowrap">online</span>
      </div>
      <div class="ml-auto flex items-center gap-2 px-2.5 py-1.5 text-[10px] text-zinc-500 shrink-0">
        <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
        {{ onlineCount }} online
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePresence } from '~/composables/usePresence'

const { users, onlineCount } = usePresence()

function activityLabel(a: string): string {
  const map: Record<string, string> = {
    writing: 'writing…',
    selecting: 'selecting…',
    clicking: 'clicking…',
  }
  return map[a] ?? 'online'
}
</script>
