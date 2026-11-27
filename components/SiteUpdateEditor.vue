<template>
  <Transition name="modal">
    <div v-if="open" class="fixed inset-0 z-50" @click.self="close">
      <div class="absolute inset-0 bg-black/55 backdrop-blur-2xl" aria-hidden="true" />

      <div class="eg-sheet absolute inset-0 flex flex-col overflow-hidden sm:inset-4 lg:inset-8">
        <!-- Header -->
        <header class="eg-sheet-header">
          <div class="min-w-0">
            <h2 class="text-[15px] font-semibold tracking-tight text-white">{{ siteUpdate ? 'Edit site update' : 'New site update' }}</h2>
            <p class="mt-0.5 truncate text-xs text-zinc-500">
              {{ siteUpdate ? 'Update this website page' : 'Publish a new website page' }}
            </p>
          </div>
          <button type="button" class="eg-icon-btn shrink-0" aria-label="Close" @click="close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>

        <!-- Form (left / mobile-first stacked) — Preview (right / desktop side-by-side) -->
        <div ref="paneContainer" class="relative flex flex-col h-full min-w-0 lg:flex-row" :style="dividerStyle">
          <form id="siteupdate-editor-form" @submit.prevent="handleSubmit" class="flex-1 min-w-0 overflow-y-auto" :class="{ 'lg:w-full': !previewOpen }">
            <div class="mx-auto w-full max-w-xl space-y-6 px-4 py-6 sm:px-6 lg:max-w-none lg:px-0 lg:py-0">
              <DetailsSection :form="form" />
              <ContentSection :form="form" />
              <WaybackSection :form="form" />
              <div v-if="!previewOpen" class="mt-4 flex justify-center">
                <button type="button" class="eg-btn-apple-secondary text-xs" @click="previewOpen = true">Show preview</button>
              </div>
            </div>
          </form>

          <div
            v-if="previewOpen"
            class="divider hidden lg:block absolute inset-y-0 left-full -translate-x-1/2 w-1.5 cursor-col-resize select-none"
            :class="{ 'w-5 bg-emerald-500 shadow-[0_0_16px_rgba(34,197,94,0.35)]': resizing }"
            @mousedown="startResize"
          />

          <SiteUpdatePreview
            v-if="previewOpen"
            class="flex-1 min-w-0 overflow-y-auto"
            :form="form"
            @hide-preview="previewOpen = false"
          />
        </div>

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
import type { SiteUpdateForm } from './siteupdate-editor/types'
import DetailsSection from './siteupdate-editor/DetailsSection.vue'
import ContentSection from './siteupdate-editor/ContentSection.vue'
import WaybackSection from './siteupdate-editor/WaybackSection.vue'
import SiteUpdatePreview from './siteupdate-editor/SiteUpdatePreview.vue'

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

const form = reactive<SiteUpdateForm>({
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
const previewOpen = ref(true)
const resizing = ref(false)
const paneContainer = ref<HTMLElement | null>(null)
const paneWidth = ref(58)

const dividerStyle = computed(() => ({ '--pane-width': `${paneWidth.value}%` }))

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
}

async function handleDelete() {
  if (!props.siteUpdate?.id) return
  if (window.confirm('Delete this site update?')) {
    emit('delete', props.siteUpdate.id)
    close()
  }
}

/* ——— resizable form / preview divider (desktop) ——— */

function startResize(event: MouseEvent) {
  if (event.button !== 0) return
  resizing.value = true
  const startX = event.clientX
  const startWidth = paneWidth.value

  const onMove = (move: MouseEvent) => {
    const rect = paneContainer.value?.getBoundingClientRect()
    const width = rect?.width || 1
    let pct = startWidth + ((move.clientX - startX) / width) * 100
    paneWidth.value = Math.min(80, Math.max(20, pct))
  }

  const onUp = () => {
    resizing.value = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp, { once: true })
}
</script>
