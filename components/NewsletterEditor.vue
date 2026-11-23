<template>
  <Transition name="modal">
    <div v-if="open" class="fixed inset-0 z-50" @click.self="close">
      <div class="absolute inset-0 bg-black/55 backdrop-blur-2xl" aria-hidden="true" />

      <div class="eg-sheet absolute inset-0 flex flex-col overflow-hidden sm:inset-4 lg:inset-8">
        <!-- Header -->
        <header class="eg-sheet-header">
          <div class="min-w-0">
            <h2 class="text-[15px] font-semibold tracking-tight text-white">
              {{ newsletter ? 'Edit newsletter' : 'New newsletter' }}
            </h2>
            <p class="mt-0.5 truncate text-xs text-zinc-500">
              {{ newsletter ? 'Update this email newsletter' : 'Compose a new email newsletter' }}
            </p>
          </div>
          <button type="button" class="eg-icon-btn shrink-0" aria-label="Close" @click="close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>

        <!-- Body -->
        <form id="newsletter-editor-form" @submit.prevent="handleSubmit" class="flex-1 overflow-y-auto">
          <div class="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6">
            <!-- Details -->
            <section class="eg-section">
              <h3 class="eg-section-title">Details</h3>
              <p class="eg-section-sub">Subject line and delivery status.</p>

              <div class="mt-4 space-y-4">
                <div>
                  <label class="eg-field-label" for="nl-title">Title <span class="req">*</span></label>
                  <input
                    id="nl-title"
                    type="text"
                    class="eg-field"
                    :value="form.title"
                    @input="form.title = ($event.target as HTMLInputElement).value"
                    maxlength="200"
                    placeholder="e.g. December 2026 — Year in Review"
                    required
                  />
                </div>

                <div>
                  <label class="eg-field-label" for="nl-subject">Email subject <span class="req">*</span></label>
                  <input
                    id="nl-subject"
                    type="text"
                    class="eg-field"
                    :value="form.subject"
                    @input="form.subject = ($event.target as HTMLInputElement).value"
                    maxlength="200"
                    placeholder="e.g. Our year in review + what's next"
                    required
                  />
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label class="eg-field-label" for="nl-status">Status</label>
                    <select id="nl-status" class="eg-select" v-model="form.status">
                      <option value="draft">Draft</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="sent">Sent</option>
                    </select>
                  </div>
                  <div v-if="form.status === 'scheduled'">
                    <label class="eg-field-label" for="nl-scheduled">Scheduled at</label>
                    <input
                      id="nl-scheduled"
                      type="datetime-local"
                      class="eg-field [color-scheme:dark]"
                      :value="form.scheduled_at"
                      @input="form.scheduled_at = ($event.target as HTMLInputElement).value"
                    />
                  </div>
                </div>

                <div>
                  <label class="eg-field-label" for="nl-recipients">Recipients</label>
                  <input
                    id="nl-recipients"
                    type="text"
                    class="eg-field"
                    :value="form.recipient_list"
                    @input="form.recipient_list = ($event.target as HTMLInputElement).value"
                    placeholder="newsletter@earthguardians.org, updates@earthguardians.org"
                  />
                  <p class="eg-hint">Comma-separated emails. Leave blank to use the default mailing list.</p>
                </div>
              </div>
            </section>

            <!-- Body -->
            <section class="eg-section">
              <div class="flex items-baseline justify-between gap-2">
                <div>
                  <h3 class="eg-section-title">Body</h3>
                  <p class="eg-section-sub">HTML content of the email.</p>
                </div>
                <span class="text-[11px] tabular-nums text-zinc-600">{{ form.body.length }} chars</span>
              </div>

              <div class="mt-4">
                <textarea
                  id="nl-body"
                  aria-label="Body HTML"
                  class="eg-textarea font-mono text-[13px]"
                  rows="14"
                  :value="form.body"
                  @input="form.body = ($event.target as HTMLTextAreaElement).value"
                  placeholder="<p>Greetings EG Family!</p>..."
                  required
                ></textarea>
              </div>
            </section>
          </div>
        </form>

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

const form = reactive<NewsletterDraft & { scheduled_at: string }>({
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
    alert('Title, subject and body are required.')
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
</script>
