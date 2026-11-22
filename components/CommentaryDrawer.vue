<template>
  <!--
    Global right-side commentary drawer.
    Opened by calling useComments().openDrawer({ type, id, path, label }).
    Can be triggered from any component, context menu, post editor,
    image viewer, etc.
  -->
  <Teleport to="body">
    <Transition name="drawer">
      <div
        v-if="drawerOpen"
        class="fixed inset-0 z-[190]"
        @pointerdown.self="closeDrawer"
      >
        <div
          class="absolute right-0 top-0 h-full w-full max-w-sm border-l border-[var(--eg-border)] bg-[var(--eg-panel)]/98 backdrop-blur-xl shadow-2xl flex flex-col"
          role="complementary"
          aria-label="Commentary"
        >
          <!-- Header -->
          <div class="flex shrink-0 items-center justify-between border-b border-[var(--eg-border)] px-5 py-4">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <svg class="h-4 w-4 shrink-0 text-[var(--eg-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round"
                    d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
                <h2 class="truncate text-sm font-semibold text-white">
                  {{ activeTarget?.label ?? labelFromTarget }}
                </h2>
              </div>
              <p v-if="activeTarget?.path" class="mt-0.5 text-[10px] text-zinc-500 truncate">
                {{ activeTarget.path }}
              </p>
            </div>

            <div class="flex items-center gap-2 shrink-0 ml-3">
              <span v-if="unresolvedCount > 0" class="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-400">
                {{ unresolvedCount }} open
              </span>
              <button
                type="button"
                class="rounded p-1 text-zinc-400 hover:text-white transition"
                aria-label="Close commentary"
                @click="closeDrawer"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Target hint -->
          <div class="shrink-0 border-b border-[var(--eg-border)] bg-zinc-900/50 px-5 py-2.5">
            <div class="flex items-center gap-2 text-[11px] text-zinc-500">
              <span class="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-400">
                {{ activeTarget?.type ?? 'general' }}
              </span>
              <span v-if="activeTarget?.id" class="truncate font-mono">{{ activeTarget.id.slice(0, 8) }}…</span>
              <span v-else class="italic">page-level</span>
            </div>
            <p class="mt-1 text-[11px] text-zinc-600">
              Tip: type <strong class="text-zinc-400">@email@domain.com</strong> to tag someone — they'll get an email notification.
            </p>
          </div>

          <!-- Comment list -->
          <div class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            <div v-if="loading" class="flex justify-center py-10">
              <span class="h-5 w-5 animate-spin rounded-full border-2 border-[var(--eg-accent)] border-t-transparent" />
            </div>

            <p v-else-if="threadedComments.length === 0" class="py-8 text-center text-sm text-zinc-600">
              No comments yet. Add the first one below.
            </p>

            <CommentThread
              v-for="comment in threadedComments"
              :key="comment.id"
              :comment="comment"
              :target="activeTarget"
              @resolve="resolveComment"
              @delete="deleteComment"
              @reply="startReply"
            />
          </div>

          <!-- Compose area -->
          <div class="shrink-0 border-t border-[var(--eg-border)] px-4 py-4">
            <!-- Reply indicator -->
            <div v-if="replyingTo" class="mb-2 flex items-center justify-between rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400">
              <span>Replying to <strong class="text-white">{{ replyingTo.author_email }}</strong></span>
              <button type="button" class="text-zinc-500 hover:text-white" @click="replyingTo = null">✕</button>
            </div>

            <div class="flex items-end gap-2">
              <textarea
                ref="textareaRef"
                v-model="draftBody"
                rows="3"
                placeholder="Add a comment… Use @email@domain.com to tag someone."
                class="eg-input w-full resize-none text-sm"
                :disabled="saving"
                @keydown.ctrl.enter.prevent="submit"
                @keydown.meta.enter.prevent="submit"
              />
              <button
                type="button"
                class="eg-btn-primary shrink-0 self-end"
                :disabled="!draftBody.trim() || saving"
                @click="submit"
              >
                <span v-if="saving" class="h-4 w-4 animate-spin rounded-full border-2 border-black/40 border-t-black inline-block" />
                <span v-else>Send</span>
              </button>
            </div>
            <p class="mt-1.5 text-[10px] text-zinc-600">Ctrl+Enter to submit</p>

            <p v-if="saveError" class="mt-2 text-xs text-red-400">{{ saveError }}</p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useComments, type Commentary, type CommentTarget } from '~/composables/useComments'

const {
  threadedComments,
  unresolvedCount,
  loading,
  saving,
  saveError,
  activeTarget,
  drawerOpen,
  closeDrawer,
  addComment,
  resolveComment,
  deleteComment,
} = useComments()

const draftBody = ref('')
const replyingTo = ref<Commentary | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const labelFromTarget = computed(() => {
  if (!activeTarget.value) return 'Comments'
  const map: Record<string, string> = {
    post: 'Post Comments',
    newsletter: 'Newsletter Comments',
    site_update: 'Site Update Comments',
    workspace: 'Workspace Comments',
    image: 'Image Comments',
    general: 'Page Comments',
  }
  return map[activeTarget.value.type] ?? 'Comments'
})

function startReply(comment: Commentary) {
  replyingTo.value = comment
  void nextTick(() => textareaRef.value?.focus())
}

async function submit() {
  const body = draftBody.value.trim()
  if (!body || !activeTarget.value) return

  const result = await addComment({
    body,
    target: activeTarget.value,
    parentId: replyingTo.value?.id ?? null,
  })

  if (result) {
    draftBody.value = ''
    replyingTo.value = null
  }
}
</script>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 150ms ease;
}
.drawer-enter-active .absolute,
.drawer-leave-active .absolute {
  transition: transform 200ms ease;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from .absolute,
.drawer-leave-to .absolute {
  transform: translateX(100%);
}
</style>
