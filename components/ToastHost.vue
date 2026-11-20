<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 px-4 pb-5"
    aria-live="polite"
    aria-atomic="true"
  >
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="pointer-events-auto flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur"
        :class="toneClass(t.tone)"
        role="status"
      >
        <span class="mt-0.5 shrink-0" aria-hidden="true">{{ icon(t.tone) }}</span>
        <span class="flex-1">{{ t.text }}</span>
        <button
          class="-mr-1 shrink-0 rounded p-1 text-current opacity-60 hover:opacity-100"
          aria-label="Dismiss"
          @click="dismiss(t.id)"
        >
          ✕
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
const { toasts, dismiss } = useToast()

function toneClass(tone: string) {
  if (tone === 'success') return 'border-emerald-500/40 bg-emerald-950/90 text-emerald-100'
  if (tone === 'error') return 'border-red-500/40 bg-red-950/90 text-red-100'
  return 'border-zinc-600/60 bg-zinc-900/95 text-zinc-100'
}

function icon(tone: string) {
  if (tone === 'success') return '✓'
  if (tone === 'error') return '!'
  return 'i'
}
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition:
    all 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(14px) scale(0.97);
}
</style>
