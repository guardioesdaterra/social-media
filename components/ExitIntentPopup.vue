/**
 * components/ExitIntentPopup.vue
 * @why Exit-intent popup shown when a visitor is about to leave the social
 * media editorial calendar. Prompts them to follow @earthguardians, share the
 * calendar, or join the newsletter before they go.
 * @component ExitIntentPopup
 * @emits dismiss
 * @deps vue (ref, watch, onMounted, onBeforeUnmount), ~/composables/useExitIntent (useExitIntent), ~/composables/useModalShell (useModalShell)
 */
<template>
  <teleport to="body">
    <transition
      name="eip"
      enter-active-class="duration-300 ease-out"
      leave-active-class="duration-200 ease-in"
    >
      <div
        v-if="localOpen"
        class="eip-overlay fixed inset-0 z-[9999] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Exit intent popup"
        @click.self="dismiss"
        @keydown.esc="dismiss"
      >
        <div
          ref="panelRef"
          class="eip-panel relative w-full max-w-md rounded-2xl border border-[var(--eg-border)] bg-[var(--bg-secondary)] shadow-2xl p-6 text-left animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:slide-in-from-left-0"
          tabindex="-1"
          @click.stop
        >
          <!-- close button -->
          <button
            class="eip-close absolute top-4 right-4 p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
            aria-label="Close"
            @click="dismiss"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <!-- footer -->
          <div class="eip-footer mt-5 pt-4 border-t border-[var(--eg-border)] flex items-center justify-between">
            <button
              class="eip-skip text-xs font-medium text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors"
              @click="dismiss"
            >
              Maybe later
            </button>
            <div class="eip-footer-note text-[10px] text-zinc-500">
              You won't see this again this session
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useExitIntent } from '~/composables/useExitIntent'
import { useModalShell } from '~/composables/useModalShell'

const props = defineProps<{
  /** When true the popup is suppressed (e.g. on auth/logged-in staff pages). */
  disabled?: boolean
}>()

const emit = defineEmits<{
  dismiss: []
}>()

const disabled = props.disabled ?? false

const { open, triggered, dismiss, reset } = useExitIntent({
  threshold: 60,
  delay: 700,
  storageKey: 'eg_social_exit_intent_dismissed',
})

// Re-sync local `open` with the composable's `open` via watch so the
// Transition component drives enter/leave classes properly.
const localOpen = ref(false)

watch(
  () => open.value,
  (val) => {
    if (disabled) {
      localOpen.value = false
      return
    }
    localOpen.value = val
  },
  { immediate: true }
)

const panelRef = ref<HTMLElement | null>(null)

useModalShell(localOpen, dismiss)

function shareCalendar() {
  if (typeof navigator.share === 'function') {
    navigator.share({
      title: 'Earth Guardians Social Media Calendar',
      text: 'Plan and track Instagram posts for @earthguardians',
      url: window.location.href,
    }).catch(() => { /* share cancelled or unavailable */ })
  } else {
    try {
      navigator.clipboard.writeText(window.location.href)
    } catch { /* clipboard unavailable */ }
  }
  dismiss()
}

onMounted(() => {
  // Focus the panel for accessibility when it opens
  watch(localOpen, (val) => {
    if (val && panelRef.value) {
      panelRef.value.focus({ preventScroll: true })
    }
  })
})

onBeforeUnmount(() => {
  dismiss()
})
</script>

<style scoped>
/* entrance / exit animation */
.eip-enter-active,
.eip-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.eip-enter-from {
  opacity: 0;
}
.eip-leave-to {
  opacity: 0;
}

/* overlay backdrop */
.eip-overlay {
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  background: rgba(4, 6, 8, 0.6);
}

/* panel text overrides for dark theme */
.eip-panel {
  color: var(--text-primary, #f5f5f5);
}

.eip-title {
  margin: 0;
  letter-spacing: -0.01em;
}

.eip-sub {
  margin: 0.15rem 0 0;
}

.eip-handle-user {
  display: block;
}
.eip-handle-label {
  display: block;
}

.eip-close svg {
  width: 16px;
  height: 16px;
}

.eip-footer-note {
  display: none;
}
@media (min-width: 640px) {
  .eip-footer-note {
    display: block;
  }
}
</style>