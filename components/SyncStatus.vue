<template>
  <div
    class="flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium"
    :class="borderClass"
    :title="title"
  >
    <span class="relative flex h-2 w-2 shrink-0">
      <span
        v-if="status !== 'live'"
        class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
        :class="dotClass"
      />
      <span class="relative inline-flex h-2 w-2 rounded-full" :class="dotClass" />
    </span>
    <span class="text-zinc-400">{{ label }}</span>
    <span v-if="lastSync" class="text-zinc-600">· {{ time }}</span>
  </div>
</template>

<script setup lang="ts">
const { realtimeStatus, lastSync, saving } = useCalendar()

const status = computed(() => (saving.value ? 'saving' : realtimeStatus.value))

const label = computed(() => {
  if (saving.value) return 'Saving…'
  if (realtimeStatus.value === 'live') return 'Live'
  if (realtimeStatus.value === 'offline') return 'Offline'
  return 'Connecting…'
})

const dotClass = computed(() =>
  status.value === 'live' ? 'bg-emerald-400' : status.value === 'saving' ? 'bg-amber-400' : 'bg-red-400',
)

const borderClass = computed(() =>
  status.value === 'live' ? 'border-emerald-500/30' : 'border-[var(--eg-border)]',
)

const time = computed(() =>
  lastSync.value ? new Date(lastSync.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '',
)

const title = computed(
  () => `Realtime: ${realtimeStatus.value}${lastSync.value ? ` · last sync ${time.value}` : ''}`,
)
</script>
