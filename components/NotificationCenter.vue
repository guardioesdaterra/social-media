<template>
  <!-- Bell button (shown in AppHeader) -->
  <div class="relative">
    <button
      type="button"
      class="eg-btn-ghost relative !px-2.5 !py-1.5"
      :aria-label="`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`"
      @click="toggle"
    >
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
      <span
        v-if="unreadCount > 0"
        class="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--eg-accent)] text-[10px] font-bold text-black"
        aria-hidden="true"
      >{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
    </button>

    <!-- Panel -->
    <Teleport to="body">
      <Transition name="notif-panel">
        <div
          v-if="panelOpen"
          class="fixed inset-0 z-[200]"
          @pointerdown.self="close"
        >
          <div
            class="absolute right-0 top-0 h-full w-full max-w-sm border-l border-[var(--eg-border)] bg-[var(--eg-panel)]/98 backdrop-blur-xl shadow-2xl flex flex-col"
          >
            <!-- Header -->
            <div class="flex items-center justify-between border-b border-[var(--eg-border)] px-5 py-4">
              <h2 class="text-sm font-semibold text-white">Notifications</h2>
              <div class="flex items-center gap-2">
                <button
                  v-if="unreadCount > 0"
                  type="button"
                  class="text-[11px] text-zinc-400 hover:text-white transition"
                  @click="markAllRead"
                >
                  Mark all read
                </button>
                <button
                  type="button"
                  class="rounded p-1 text-zinc-400 hover:text-white transition"
                  aria-label="Close notifications"
                  @click="close"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- List -->
            <div class="flex-1 overflow-y-auto">
              <div v-if="loading" class="flex items-center justify-center py-16">
                <span class="h-6 w-6 animate-spin rounded-full border-2 border-[var(--eg-accent)] border-t-transparent" />
              </div>

              <div v-else-if="notifications.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
                <svg class="h-10 w-10 text-zinc-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                <p class="text-sm text-zinc-500">You're all caught up</p>
              </div>

              <ul v-else class="divide-y divide-[var(--eg-border)]">
                <li
                  v-for="n in notifications"
                  :key="n.id"
                  class="group relative px-5 py-4 transition"
                  :class="n.read_at ? 'opacity-70' : 'bg-white/[0.03]'"
                >
                  <!-- Unread dot -->
                  <span
                    v-if="!n.read_at"
                    class="absolute left-2 top-5 h-1.5 w-1.5 rounded-full bg-[var(--eg-accent)]"
                    aria-hidden="true"
                  />

                  <div class="flex items-start gap-3">
                    <!-- Icon by event type -->
                    <div class="mt-0.5 shrink-0 text-zinc-400" :class="eventIconClass(n.event_type)">
                      <svg v-if="n.event_type === 'tag' || n.event_type === 'mention'" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z" />
                      </svg>
                      <svg v-else-if="n.event_type === 'comment_reply'" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                      </svg>
                      <svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                      </svg>
                    </div>

                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-zinc-200 leading-snug">{{ n.title }}</p>
                      <p v-if="n.body" class="mt-0.5 text-xs text-zinc-500 line-clamp-2">{{ n.body }}</p>
                      <div class="mt-1.5 flex items-center gap-2">
                        <span class="text-[10px] text-zinc-600">{{ relativeTime(n.created_at) }}</span>
                        <NuxtLink
                          v-if="n.link_path"
                          :to="n.link_path"
                          class="text-[10px] text-[var(--eg-accent)] hover:underline"
                          @click="close"
                        >
                          View →
                        </NuxtLink>
                      </div>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useNotifications } from '~/composables/useNotifications'

const { notifications, loading, panelOpen, unreadCount, load, markAllRead, subscribeRealtime, unsubscribeRealtime, openPanel, closePanel } = useNotifications()

function toggle() {
  if (panelOpen.value) closePanel()
  else openPanel()
}

function close() {
  closePanel()
}

function eventIconClass(type: string): string {
  if (type === 'tag' || type === 'mention') return 'text-[var(--eg-accent)]'
  if (type === 'comment_reply') return 'text-blue-400'
  return 'text-zinc-400'
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

onMounted(async () => {
  await load()
  subscribeRealtime()
})

onUnmounted(() => {
  unsubscribeRealtime()
})
</script>

<style scoped>
.notif-panel-enter-active,
.notif-panel-leave-active {
  transition: opacity 150ms ease, transform 200ms ease;
}
.notif-panel-enter-from .absolute,
.notif-panel-leave-to .absolute {
  transform: translateX(100%);
  opacity: 0;
}
</style>
