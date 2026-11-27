<template>
  <Transition name="modal">
    <div v-if="open" class="fixed inset-0 z-50" @click.self="close">
      <div class="absolute inset-0 bg-black/55 backdrop-blur-2xl" aria-hidden="true" />

      <div class="eg-sheet absolute inset-0 flex flex-col overflow-hidden sm:inset-4 lg:inset-8">
        <!-- Header -->
        <header class="eg-sheet-header">
          <div class="min-w-0">
            <h2 class="text-[15px] font-semibold tracking-tight text-white">{{ newsletter ? 'Edit newsletter' : 'New newsletter' }}</h2>
            <p class="mt-0.5 truncate text-xs text-zinc-500">
              {{ newsletter ? 'Update this email newsletter' : 'Compose a new email newsletter' }}
            </p>
          </div>
          <button type="button" class="eg-icon-btn shrink-0" aria-label="Close" @click="close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>

        <!-- Form (left / mobile-first stacked) — Preview (right / desktop side-by-side) -->
        <div ref="paneContainer" class="relative flex flex-col h-full min-w-0 lg:flex-row" :style="dividerStyle">
          <form id="newsletter-editor-form" @submit.prevent="handleSubmit" class="flex-1 min-w-0 overflow-y-auto" :class="{ 'lg:w-full': !previewOpen }">
            <div class="mx-auto w-full max-w-xl space-y-6 px-4 py-6 sm:px-6 lg:max-w-none lg:px-0 lg:py-0">
              <DetailsSection :form="form" />
              <BodySection :form="form" />
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

          <NewsletterPreview
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
            form="newsletter-editor-form"
            class="eg-btn-apple-primary"
            :disabled="saving || !form.title || !form.subject || !form.body"
          >
            <span v-if="saving" class="flex items-center gap-2">
              <span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
              Saving…
            </span>
            <span v-else>{{ newsletter ? 'Save changes' : 'Create newsletter' }}</span>
          </button>
        </footer>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { Newsletter, NewsletterDraft } from '~/lib/types'
import { computed, reactive, ref, watch } from 'vue'
import { useSupabaseAuth } from '~/composables/useSupabaseAuth'
import { useToast } from '~/composables/useToast'
import type { NewsletterForm } from './newsletter-editor/types'
import DetailsSection from './newsletter-editor/DetailsSection.vue'
import BodySection from './newsletter-editor/BodySection.vue'
import NewsletterPreview from './newsletter-editor/NewsletterPreview.vue'

const props = defineProps<{
  open: boolean
  newsletter: Newsletter | null
}>()

const emit = defineEmits<{
  save: [draft: NewsletterDraft]
  delete: [id: string]
  cancel: []
  'update:open': [open: boolean]
}>()

const { phase } = useSupabaseAuth()
const canEdit = computed(() => phase.value === 'manager')
const toast = useToast()

const form = reactive<NewsletterForm>({
  id: '',
  title: '',
  subject: '',
  body: '',
  status: 'draft',
  scheduled_at: '',
  sent_at: null,
  recipient_list: '',
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
  const n = props.newsletter
  saving.value = false
  form.id = n?.id ?? ''
  form.title = n?.title ?? ''
  form.subject = n?.subject ?? ''
  form.body = n?.body ?? ''
  form.status = (n?.status ?? 'draft') as 'draft' | 'scheduled' | 'sent'
  form.scheduled_at = n?.scheduled_at ? n.scheduled_at.slice(0, 16) : ''
  form.recipient_list = n?.recipient_list ?? ''
}

async function handleSubmit() {
  if (!form.title || !form.subject || !form.body) {
    toast.error('Title, subject and body are required.')
    return
  }

  const draft: NewsletterDraft = {
    id: form.id || undefined,
    title: form.title,
    subject: form.subject,
    body: form.body,
    status: form.status,
    scheduled_at: form.scheduled_at || null,
    sent_at: form.sent_at ?? null,
    recipient_list: form.recipient_list || '',
  }

  saving.value = true
  emit('save', draft)
  // Do not close here: the parent closes the modal after the save promise
  // resolves. Closing now would lose the form if the server rejects it.
}

async function handleDelete() {
  if (!props.newsletter?.id) return
  if (window.confirm('Delete this newsletter?')) {
    emit('delete', props.newsletter.id)
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
