<template>
  <Transition name="modal">
    <div v-if="open" class="fixed inset-0 z-50" @click.self="close">
      <div class="absolute inset-0 bg-black/55 backdrop-blur-2xl" aria-hidden="true" />

      <div class="eg-sheet absolute inset-0 flex flex-col overflow-hidden sm:inset-4 lg:inset-8">
        <!-- Header -->
        <header class="eg-sheet-header">
          <div class="min-w-0">
            <h2 class="text-[15px] font-semibold tracking-tight text-white">
              {{ siteUpdate ? 'Edit site update' : 'New site update' }}
            </h2>
            <p class="mt-0.5 truncate text-xs text-zinc-500">
              {{ siteUpdate ? 'Update this website page' : 'Publish a new website page' }}
            </p>
          </div>
          <button type="button" class="eg-icon-btn shrink-0" aria-label="Close" @click="close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>

        <!-- Body -->
        <form id="siteupdate-editor-form" @submit.prevent="handleSubmit" class="flex-1 overflow-y-auto">
          <div class="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6">
            <!-- Details -->
            <section class="eg-section">
              <h3 class="eg-section-title">Details</h3>
              <p class="eg-section-sub">Title, slug and publishing status.</p>

              <div class="mt-4 space-y-4">
                <div>
                  <label class="eg-field-label" for="su-title">Title <span class="req">*</span></label>
                  <input
                    id="su-title"
                    type="text"
                    class="eg-field"
                    :value="form.title"
                    @input="form.title = ($event.target as HTMLInputElement).value"
                    maxlength="200"
                    placeholder="e.g. New restoration dashboard launched"
                    required
                  />
                </div>

                <div>
                  <label class="eg-field-label" for="su-slug">URL slug <span class="req">*</span></label>
                  <input
                    id="su-slug"
                    type="text"
                    class="eg-field"
                    :value="form.slug"
                    @input="form.slug = ($event.target as HTMLInputElement).value"
                    maxlength="200"
                    placeholder="e.g. restoration-dashboard"
                    required
                  />
                  <p class="eg-hint">Lowercase, digits and hyphens only.</p>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label class="eg-field-label" for="su-status">Status</label>
                    <select id="su-status" class="eg-select" v-model="form.status">
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  <div v-if="form.status === 'published'">
                    <label class="eg-field-label" for="su-published">Published at</label>
                    <input
                      id="su-published"
                      type="datetime-local"
                      class="eg-field [color-scheme:dark]"
                      :value="form.published_at"
                      @input="form.published_at = ($event.target as HTMLInputElement).value"
                    />
                  </div>
                </div>

                <div>
                  <label class="eg-field-label" for="su-url">Page URL</label>
                  <input
                    id="su-url"
                    type="url"
                    class="eg-field"
                    :value="form.url"
                    @input="form.url = ($event.target as HTMLInputElement).value"
                    placeholder="https://earthguardians.org/restoration-dashboard"
                  />
                </div>
              </div>
            </section>

            <!-- Content -->
            <section class="eg-section">
              <div class="flex items-baseline justify-between gap-2">
                <div>
                  <h3 class="eg-section-title">Content</h3>
                  <p class="eg-section-sub">HTML markup of the page.</p>
                </div>
                <span class="text-[11px] tabular-nums text-zinc-600">{{ form.content.length }} chars</span>
              </div>

              <div class="mt-4">
                <textarea
                  id="su-content"
                  aria-label="Content HTML"
                  class="eg-textarea font-mono text-[13px]"
                  rows="12"
                  :value="form.content"
                  @input="form.content = ($event.target as HTMLTextAreaElement).value"
                  placeholder="<h1>Welcome</h1><p>...</p>"
                  required
                ></textarea>
              </div>
            </section>

            <!-- Wayback -->
            <section class="eg-section">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 class="eg-section-title">Wayback Machine</h3>
                  <p class="eg-section-sub">Snapshots and visual diffs from web.archive.org.</p>
                </div>
                <div class="eg-segmented" role="tablist" aria-label="Wayback views">
                  <button
                    type="button"
                    role="tab"
                    class="eg-segmented-item"
                    :class="{ 'is-active': waybackTab === 'snapshots' }"
                    :aria-selected="waybackTab === 'snapshots'"
                    @click="waybackTab = 'snapshots'"
                  >
                    📸 Snapshots
                  </button>
                  <button
                    type="button"
                    role="tab"
                    class="eg-segmented-item"
                    :class="{ 'is-active': waybackTab === 'diff' }"
                    :aria-selected="waybackTab === 'diff'"
                    :disabled="waybackSnapshots.length < 2"
                    @click="waybackTab = 'diff'"
                  >
                    🔄 Compare
                  </button>
                </div>
              </div>

              <!-- Snapshots Tab -->
              <div v-if="waybackTab === 'snapshots'" class="mt-4">
                <WaybackPicker
                  :prefillUrl="form.url || undefined"
                  @snapshots="onSnapshotsLoaded"
                  @select="onSelectSnapshot"
                  @compare="onCompareSnapshots"
                />

                <!-- Snapshot preview iframe -->
                <div v-if="previewSnapshot" class="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black">
                  <div class="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-3 py-2 backdrop-blur">
                    <span class="text-xs text-zinc-400">Preview: {{ formatSnapshotDate(previewSnapshot.timestamp) }}</span>
                    <button type="button" class="eg-icon-btn h-6 w-6" aria-label="Close preview" @click="previewSnapshot = null">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div class="relative h-[500px] w-full">
                    <iframe
                      :src="previewReplayUrl"
                      class="h-full w-full"
                      sandbox="allow-same-origin allow-scripts"
                      title="Wayback snapshot preview"
                    />
                  </div>
                  <a
                    :href="previewReplayUrl"
                    target="_blank"
                    rel="noopener"
                    class="block border-t border-white/10 px-3 py-2 text-xs text-[var(--eg-accent)] transition hover:bg-white/5 hover:underline"
                  >
                    Open in new tab ↗
                  </a>
                </div>
              </div>

              <!-- Diff Tab -->
              <div v-if="waybackTab === 'diff' && waybackSnapshots.length >= 2" class="mt-4">
                <DiffViewer
                  :snapshots="waybackSnapshots"
                  :url="form.url || ''"
                  @change="onDiffChange"
                />
              </div>
            </section>
          </div>
        </form>

        <!-- Footer -->
        <footer class="eg-sheet-footer">
          <button type="button" class="eg-btn-apple-secondary" @click="close">Cancel</button>
          <button
            type="submit"
            form="siteupdate-editor-form"
            class="eg-btn-apple-primary"
            :disabled="saving || !form.title || !form.slug || !form.content"
          >
            <span v-if="saving" class="flex items-center gap-2">
              <span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
              Saving…
            </span>
            <span v-else>{{ siteUpdate ? 'Save changes' : 'Create site update' }}</span>
          </button>
        </footer>
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

const saving = ref(false)

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
  saving.value = false
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

  saving.value = true
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
