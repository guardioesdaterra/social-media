<template>
  <AuthGate>
    <div class="flex min-h-0 flex-1 flex-col">
      <!-- Toolbar -->
      <header class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--eg-border)] px-3 py-2.5 sm:px-4 bg-black/60 backdrop-blur sticky top-0 z-20">
        <div class="flex items-center gap-2 shrink-0">
          <button
            class="eg-btn-ghost !px-2.5 !py-1.5 rounded-lg"
            aria-label="Back to calendar"
            @click="router.push('/calendario')"
          >
            ← Calendar
          </button>
        </div>

        <h1 class="flex-1 text-center text-sm font-semibold text-white sm:text-base">
          Newsletters
        </h1>

        <div class="flex items-center gap-2">
          <button
            class="eg-btn-primary !px-3 !py-1.5 text-xs shrink-0"
            :disabled="!isManager || saving"
            @click="openEditor()"
          >
            + New newsletter
          </button>

          <button class="eg-btn-ghost !px-2.5 !py-1.5 text-xs shrink-0" @click="onSignOut">
            Sign out
          </button>
        </div>
      </header>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto p-3 sm:p-4">
        <div v-if="loading" class="flex flex-col items-center gap-3 py-12">
          <span class="h-6 w-6 animate-spin rounded-full border-2 border-[var(--eg-accent)] border-t-transparent" />
          <p class="text-sm text-zinc-400">Loading newsletters…</p>
        </div>

        <div v-else-if="loadError" class="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-center">
          <p class="text-sm text-red-300">{{ loadError }}</p>
        </div>

        <div v-else-if="newsletters.length === 0" class="rounded-xl border border-[var(--eg-border)] bg-white/[0.02] p-12 text-center">
          <p class="text-sm text-zinc-500">No newsletters yet.</p>
          <button
            v-if="isManager"
            class="mt-3 eg-btn-primary !px-4 !py-1.5 text-xs"
            @click="openEditor()"
          >
            Create a newsletter
          </button>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="n in newsletters"
            :key="n.id"
            class="eg-card p-3 relative group"
            @contextmenu.stop.prevent="onCardContext($event, n)"
          >
            <div class="flex items-start gap-2">
              <span
                class="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                :style="{ background: statusColor(n.status) + '20', color: statusColor(n.status) }"
              >
                {{ n.status }}
              </span>
              <div class="flex-1 min-w-0">
                <h3 class="text-sm font-semibold text-white truncate">{{ n.title }}</h3>
                <p class="text-[11px] text-zinc-400 truncate">{{ n.subject }}</p>
                <div class="flex items-center gap-2 mt-1">
                  <span class="text-[10px] text-zinc-500">{{ n.created_at }}</span>
                  <span v-if="n.scheduled_at" class="text-[10px] text-zinc-500">
                    · scheduled {{ n.scheduled_at }}
                  </span>
                  <span v-if="n.sent_at" class="text-[10px] text-green-400">· sent {{ n.sent_at }}</span>
                </div>
              </div>
              <div class="flex items-center gap-1">
                <button
                  class="eg-btn-ghost !px-2 !py-1 text-[10px] text-zinc-400 hover:text-white"
                  aria-label="Edit newsletter"
                  @click="openEditor(n)"
                >
                  ✎
                </button>
                <button
                  v-if="isManager"
                  class="eg-btn-danger !px-2 !py-1 text-[10px] text-red-400 hover:text-red-300"
                  aria-label="Delete newsletter"
                  @click="deleteNewsletter(n.id)"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="border-t border-[var(--eg-border)] p-3 text-center">
          <p class="text-[11px] text-zinc-500">
            {{ stats.total }} newsletters · v
          </p>
        </div>
      </div>

      <!-- Editor modal -->
      <NewsletterEditor
        v-model:open="editorOpen"
        :newsletter="editorNewsletter"
        @save="saveNewsletter"
        @delete="deleteNewsletter"
        @cancel="editorOpen = false"
      />
    </div>
  </AuthGate>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Newsletter } from '~/lib/types'
import type { ContextMenuEntry } from '~/composables/useContextMenu'

import AuthGate from '~/components/AuthGate.vue'
import NewsletterEditor from '~/components/NewsletterEditor.vue'

const router = useRouter()

const newsletter = useNewsletters()
const auth = useSupabaseAuth()
const toast = useToast()
const ctx = useContextMenu()
const { copyText } = useCopyText()

const {
  newsletters,
  loading,
  saving,
  loadError,
  stats,
  load,
  connectRealtime,
  init,
} = newsletter

const { manager } = auth
const isManager = computed(() => auth.phase.value === 'manager')

// editor
const editorOpen = ref(false)
const editorNewsletter = ref<Newsletter | null>(null)

function statusColor(status: string): string {
  switch (status) {
    case 'draft': return '#71717a'
    case 'scheduled': return '#eab308'
    case 'sent': return '#22c55e'
    default: return '#71717a'
  }
}

function openEditor(n?: Newsletter) {
  editorNewsletter.value = n ?? null
  editorOpen.value = true
}

async function onSignOut() {
  await auth.signOut()
  toast.info('Signed out.')
  await navigateTo('/login')
}

async function saveNewsletter(draft: any) {
  try {
    await newsletter.save({ action: 'upsert_newsletter', newsletter: draft })
    toast.success('Newsletter saved.')
    editorOpen.value = false
  } catch (err: any) {
    toast.error(err?.message || 'Could not save newsletter.')
  }
}

async function deleteNewsletter(id: string) {
  try {
    await newsletter.deleteNewsletter(id)
    toast.success('Newsletter deleted.')
  } catch (err: any) {
    toast.error(err?.message || 'Could not delete newsletter.')
  }
}

/** Right-click on a newsletter card → contextual actions. */
function onCardContext(e: MouseEvent, n: Newsletter) {
  const items: ContextMenuEntry[] = [
    { label: 'Edit newsletter', onSelect: () => openEditor(n) },
    { label: 'Copy title', onSelect: () => void copyText(n.title, 'Title copied.') },
  ]
  if (n.subject) {
    items.push({ label: 'Copy subject', onSelect: () => void copyText(n.subject || '', 'Subject copied.') })
  }
  if (n.body) {
    items.push({ label: 'Copy body', onSelect: () => void copyText(n.body, 'Body copied.') })
  }
  items.push({ type: 'separator' }, { label: 'Copy status', hint: n.status, onSelect: () => void copyText(n.status, 'Status copied.') })
  if (isManager.value) {
    items.push({ type: 'separator' }, { label: 'Delete newsletter', danger: true, onSelect: () => void deleteNewsletter(n.id) })
  }
  ctx.openFromEvent(e, items)
}

async function initApp() {
  await init()
  if (auth.isManager.value) {
    connectRealtime()
  }
}

onMounted(initApp)

watch(
  () => auth.phase.value,
  (phase) => {
    if (phase === 'manager') void initApp()
  },
)
</script>
