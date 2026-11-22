<template>
  <Transition name="modal">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="close">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div class="relative w-full max-w-[92vw] max-h-[85vh] bg-[var(--eg-panel)] border border-[var(--eg-border)] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div class="flex items-center justify-between gap-3 border-b border-[var(--eg-border)] px-4 py-3">
          <h2 class="text-sm font-semibold text-white">
            {{ siteUpdate ? 'Edit site update' : 'New site update' }}
          </h2>
          <button
            class="eg-btn-ghost !px-1.5 !py-1 text-[10px] text-zinc-400 hover:text-white"
            @click="close"
          >
            ✕
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="p-4 space-y-3 flex-1 overflow-y-auto">
          <!-- Title -->
          <div>
            <label class="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">
              Title
            </label>
            <input
              type="text"
              class="eg-input text-sm"
              :value="form.title"
              @input="form.title = ($event.target as HTMLInputElement).value"
              maxlength="200"
              placeholder="e.g. New restoration dashboard launched"
              required
            />
          </div>

          <!-- Slug -->
          <div>
            <label class="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">
              URL slug
            </label>
            <input
              type="text"
              class="eg-input text-sm"
              :value="form.slug"
              @input="form.slug = ($event.target as HTMLInputElement).value"
              maxlength="200"
              placeholder="e.g. restoration-dashboard"
              required
            />
            <p class="mt-1 text-[10px] text-zinc-500">Lowercase, digits and hyphens only.</p>
          </div>

          <!-- Status -->
          <div>
            <label class="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">
              Status
            </label>
            <select class="eg-input text-sm" v-model="form.status">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <!-- Published at -->
          <div v-if="form.status === 'published'">
            <label class="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">
              Published at
            </label>
            <input
              type="datetime-local"
              class="eg-input text-sm"
              :value="form.published_at"
              @input="form.published_at = ($event.target as HTMLInputElement).value"
            />
          </div>

          <!-- URL -->
          <div>
            <label class="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">
              Page URL
            </label>
            <input
              type="text"
              class="eg-input text-sm"
              :value="form.url"
              @input="form.url = ($event.target as HTMLInputElement).value"
              placeholder="https://earthguardians.org/restoration-dashboard"
            />
          </div>

          <!-- Content -->
          <div>
            <label class="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">
              Content (HTML)
            </label>
            <textarea
              class="eg-input text-sm font-mono"
              rows="12"
              :value="form.content"
              @input="form.content = ($event.target as HTMLTextAreaElement).value"
              placeholder="<h1>Welcome</h1><p>...</p>"
              required
            ></textarea>
            <p class="mt-1 text-[10px] text-zinc-600">{{ form.content.length }} chars.</p>
          </div>

          <!-- Wayback Integration Tabs -->
          <div class="pt-3 border-t border-[var(--eg-border)]">
            <div class="flex gap-1 mb-3">
              <button
                type="button"
                class="px-3 py-1.5 text-xs rounded-lg transition-colors"
                :class="waybackTab === 'snapshots' ? 'bg-[var(--eg-accent)] text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'"
                @click="waybackTab = 'snapshots'"
              >
                📸 Snapshots
              </button>
              <button
                type="button"
                class="px-3 py-1.5 text-xs rounded-lg transition-colors"
                :class="waybackTab === 'diff' ? 'bg-[var(--eg-accent)] text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'"
                @click="waybackTab = 'diff'"
                :disabled="waybackSnapshots.length < 2"
              >
                🔄 Compare
              </button>
            </div>

            <!-- Snapshots Tab -->
            <div v-if="waybackTab === 'snapshots'">
              <WaybackPicker
                :prefillUrl="form.url || undefined"
                @snapshots="onSnapshotsLoaded"
                @select="onSelectSnapshot"
                @compare="onCompareSnapshots"
              />

              <!-- Snapshot preview iframe -->
              <div v-if="previewSnapshot" class="mt-4 rounded-lg border border-[var(--eg-border)] bg-black overflow-hidden">
                <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--eg-border)] bg-zinc-900">
                  <span class="text-xs text-zinc-400">Preview: {{ formatSnapshotDate(previewSnapshot.timestamp) }}</span>
                  <button
                    type="button"
                    class="eg-btn-ghost !px-1.5 !py-1 text-[10px] text-zinc-400 hover:text-white"
                    @click="previewSnapshot = null"
                  >
                    ✕
                  </button>
                </div>
                <div class="relative w-full h-[500px]">
                  <iframe
                    :src="previewReplayUrl"
                    class="w-full h-full"
                    sandbox="allow-same-origin allow-scripts"
                    title="Wayback snapshot preview"
                  />
                </div>
                <a
                  :href="previewReplayUrl"
                  target="_blank"
                  rel="noopener"
                  class="block px-3 py-2 text-xs text-[var(--eg-accent)] hover:underline border-t border-[var(--eg-border)]"
                >
                  Open in new tab ↗
                </a>
              </div>
            </div>

            <!-- Diff Tab -->
            <div v-if="waybackTab === 'diff' && waybackSnapshots.length >= 2">
              <DiffViewer
                :snapshots="waybackSnapshots"
                :url="form.url || ''"
                @change="onDiffChange"
              />
            </div>
          </div>

          <div class="mt-4 flex justify-end gap-2">
            <button type="button" class="eg-btn-ghost !px-3 !py-1.5 text-xs" @click="close">
              Cancel
            </button>
            <button
              type="submit"
              class="eg-btn-primary !px-4 !py-1.5 text-xs"
              :disabled="saving || !form.title || !form.slug || !form.content"
            >
              <span v-if="saving" class="flex items-center gap-2">
                <span class="h-3 w-3 animate-spin rounded-full border border-current border-r-transparent" />
                Saving...
              </span>
              <span v-else>Save site update</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { SiteUpdate, SiteUpdateDraft } from '~/lib/types'
import { computed, reactive, ref, watch } from 'vue'
import { useSupabaseAuth } from '~/composables/useSupabaseAuth'
import type { WaybackSnapshot, WaybackDiff } from '~/composables/useWayback'
import WaybackPicker from './WaybackPicker.vue'
import DiffViewer from './DiffViewer.vue'

const props = defineProps<{
  open: boolean
  siteUpdate: SiteUpdate | null
}>()

const emit = defineEmits<{
  save: [draft: SiteUpdateDraft]
  delete: [id: string]
  cancel: []
  'update:open': [open: boolean]
}>()

const { phase } = useSupabaseAuth()
const canEdit = computed(() => phase.value === 'manager')

const form = reactive<SiteUpdateDraft & { published_at: string }>({
  id: '',
  title: '',
  slug: '',
  content: '',
  status: 'draft',
  published_at: '',
  url: '',
  wayback_url: '',
  snapshot_timestamps: [],
  last_diff: '',
})

let saving = false

// Wayback state
const waybackTab = ref<'snapshots' | 'diff'>('snapshots')
const waybackSnapshots = ref<WaybackSnapshot[]>([])
const currentDiff = ref<WaybackDiff | null>(null)
const previewSnapshot = ref<WaybackSnapshot | null>(null)

const previewReplayUrl = computed(() => {
  if (!previewSnapshot.value || !form.url) return ''
  return `https://web.archive.org/web/${previewSnapshot.value.timestamp}/${form.url}`
})

function close() {
  emit('update:open', false)
}

watch(
  () => props.open,
  (open) => {
    if (open) resetForm()
  },
)

function resetForm() {
  const u = props.siteUpdate
  form.id = u?.id ?? ''
  form.title = u?.title ?? ''
  form.slug = u?.slug ?? ''
  form.content = u?.content ?? ''
  form.status = (u?.status ?? 'draft') as 'draft' | 'published' | 'archived'
  form.published_at = u?.published_at ? u.published_at.slice(0, 16) : ''
  form.url = u?.url ?? ''
  form.wayback_url = u?.wayback_url ?? ''
  form.snapshot_timestamps = u?.snapshot_timestamps ? [...u.snapshot_timestamps] : []
  form.last_diff = u?.last_diff ?? ''
  
  // Reset Wayback state
  waybackSnapshots.value = []
  currentDiff.value = null
  previewSnapshot.value = null
  waybackTab.value = 'snapshots'
}

function onSnapshotsLoaded(snapshots: WaybackSnapshot[]) {
  waybackSnapshots.value = snapshots
  form.snapshot_timestamps = snapshots.map(s => s.timestamp)
}

function onSelectSnapshot(snap: WaybackSnapshot) {
  previewSnapshot.value = snap
  waybackTab.value = 'snapshots'
}

function onCompareSnapshots(snapshots: WaybackSnapshot[]) {
  waybackSnapshots.value = snapshots
  waybackTab.value = 'diff'
}

function onDiffChange(from: WaybackSnapshot, to: WaybackSnapshot) {
  // Store diff info in the form
  const diffInfo = {
    from: from.timestamp,
    to: to.timestamp,
    url: form.url,
  }
  form.last_diff = JSON.stringify(diffInfo)
}

function formatSnapshotDate(timestamp: string): string {
  if (!timestamp) return ''
  const year = timestamp.slice(0, 4)
  const month = timestamp.slice(4, 6)
  const day = timestamp.slice(6, 8)
  return `${year}-${month}-${day}`
}

async function handleSubmit() {
  if (!form.title || !form.slug || !form.content) {
    alert('Title, slug and content are required.')
    return
  }

  const draft: SiteUpdateDraft = {
    id: form.id || undefined,
    title: form.title,
    slug: form.slug,
    content: form.content,
    status: form.status,
    published_at: form.published_at || null,
    url: form.url || null,
    wayback_url: form.url || null,
    snapshot_timestamps: form.snapshot_timestamps,
    last_diff: form.last_diff || null,
  }

  saving = true
  emit('save', draft)
  // Do not close here: the parent closes the modal after the save promise resolves
}

async function handleDelete() {
  if (!props.siteUpdate?.id) return
  if (window.confirm('Delete this site update?')) {
    emit('delete', props.siteUpdate.id)
    close()
  }
}
</script>
