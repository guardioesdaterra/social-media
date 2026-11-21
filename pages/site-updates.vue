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
          Site updates
        </h1>

        <div class="flex items-center gap-2">
          <button
            class="eg-btn-primary !px-3 !py-1.5 text-xs shrink-0"
            :disabled="!isManager || saving"
            @click="openEditor()"
          >
            + New site update
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
          <p class="text-sm text-zinc-400">Loading site updates…</p>
        </div>

        <div v-else-if="loadError" class="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-center">
          <p class="text-sm text-red-300">{{ loadError }}</p>
        </div>

        <div v-else-if="siteUpdates.length === 0" class="rounded-xl border border-[var(--eg-border)] bg-white/[0.02] p-12 text-center">
          <p class="text-sm text-zinc-500">No site updates yet.</p>
          <button
            v-if="isManager"
            class="mt-3 eg-btn-primary !px-4 !py-1.5 text-xs"
            @click="openEditor()"
          >
            Create a site update
          </button>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="u in siteUpdates"
            :key="u.id"
            class="eg-card p-3 relative group"
            @contextmenu.stop.prevent="onCardContext($event, u)"
          >
            <div class="flex items-start gap-2">
              <span
                class="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                :style="{ background: statusColor(u.status) + '20', color: statusColor(u.status) }"
              >
                {{ u.status }}
              </span>
              <div class="flex-1 min-w-0">
                <h3 class="text-sm font-semibold text-white truncate">{{ u.title }}</h3>
                <p class="text-[11px] text-zinc-400 truncate">{{ u.slug }}</p>
                <div class="flex items-center gap-2 mt-1">
                  <span class="text-[10px] text-zinc-500">{{ u.created_at }}</span>
                  <span v-if="u.published_at" class="text-[10px] text-green-400">
                    · published {{ u.published_at }}
                  </span>
                  <span v-if="u.url" class="text-[10px] text-zinc-500">
                    · {{ u.url }}
                  </span>
                </div>
              </div>
              <div class="flex items-center gap-1">
                <button
                  class="eg-btn-ghost !px-2 !py-1 text-[10px] text-zinc-400 hover:text-white"
                  aria-label="Edit site update"
                  @click="openEditor(u)"
                >
                  ✎
                </button>
                <button
                  v-if="isManager"
                  class="eg-btn-danger !px-2 !py-1 text-[10px] text-red-400 hover:text-red-300"
                  aria-label="Delete site update"
                  @click="deleteSiteUpdate(u.id)"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="border-t border-[var(--eg-border)] p-3 text-center">
          <p class="text-[11px] text-zinc-500">
            {{ stats.total }} site updates · v
          </p>
        </div>
      </div>

      <!-- Editor modal -->
      <SiteUpdateEditor
        v-model:open="editorOpen"
        :siteUpdate="editorSiteUpdate"
        @save="saveSiteUpdate"
        @delete="deleteSiteUpdate"
        @cancel="editorOpen = false"
      />
    </div>
  </AuthGate>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { SiteUpdate } from '~/lib/types'
import type { ContextMenuEntry } from '~/composables/useContextMenu'

import AuthGate from '~/components/AuthGate.vue'
import SiteUpdateEditor from '~/components/SiteUpdateEditor.vue'

const router = useRouter()

const siteUpdate = useSiteUpdates()
const auth = useSupabaseAuth()
const toast = useToast()
const ctx = useContextMenu()
const { copyText } = useCopyText()

const {
  siteUpdates,
  loading,
  saving,
  loadError,
  stats,
  load,
  connectRealtime,
  init,
} = siteUpdate

const { manager } = auth
const isManager = computed(() => auth.phase.value === 'manager')

// editor
const editorOpen = ref(false)
const editorSiteUpdate = ref<SiteUpdate | null>(null)

function statusColor(status: string): string {
  switch (status) {
    case 'draft': return '#71717a'
    case 'published': return '#22c55e'
    case 'archived': return '#71717a'
    default: return '#71717a'
  }
}

function openEditor(u?: SiteUpdate) {
  editorSiteUpdate.value = u ?? null
  editorOpen.value = true
}

async function onSignOut() {
  await auth.signOut()
  toast.info('Signed out.')
  await navigateTo('/login')
}

async function saveSiteUpdate(draft: any) {
  try {
    await siteUpdate.save({ action: 'upsert_site_update', site_update: draft })
    toast.success('Site update saved.')
    editorOpen.value = false
  } catch (err: any) {
    toast.error(err?.message || 'Could not save site update.')
  }
}

async function deleteSiteUpdate(id: string) {
  try {
    await siteUpdate.deleteSiteUpdate(id)
    toast.success('Site update deleted.')
  } catch (err: any) {
    toast.error(err?.message || 'Could not delete site update.')
  }
}

/** Right-click on a site-update card → contextual actions. */
function onCardContext(e: MouseEvent, u: SiteUpdate) {
  const items: ContextMenuEntry[] = [
    { label: 'Edit site update', onSelect: () => openEditor(u) },
    { label: 'Copy title', onSelect: () => void copyText(u.title, 'Title copied.') },
  ]
  if (u.slug) {
    items.push({ label: 'Copy slug', hint: u.slug, onSelect: () => void copyText(u.slug, 'Slug copied.') })
  }
  if (u.url) {
    items.push({ label: 'Copy URL', onSelect: () => void copyText(u.url || '', 'URL copied.') })
  }
  if (u.content) {
    items.push({ label: 'Copy content', onSelect: () => void copyText(u.content, 'Content copied.') })
  }
  items.push({ type: 'separator' }, { label: 'Copy status', hint: u.status, onSelect: () => void copyText(u.status, 'Status copied.') })
  if (isManager.value) {
    items.push({ type: 'separator' }, { label: 'Delete site update', danger: true, onSelect: () => void deleteSiteUpdate(u.id) })
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
