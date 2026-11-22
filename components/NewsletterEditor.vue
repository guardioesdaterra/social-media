<template>
  <Transition name="modal">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="close">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div class="relative w-full max-w-[92vw] max-h-[85vh] bg-[var(--eg-panel)] border border-[var(--eg-border)] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div class="flex items-center justify-between gap-3 border-b border-[var(--eg-border)] px-4 py-3">
          <h2 class="text-sm font-semibold text-white">
            {{ newsletter ? 'Edit newsletter' : 'New newsletter' }}
          </h2>
          <button
            class="eg-glass-btn-ghost !px-1.5 !py-1 text-[10px] text-zinc-400 hover:text-white"
            @click="close"
          >
            ✕
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="p-4 space-y-3 flex-1 overflow-y-auto">
          <!-- Title -->
          <div>
            <label class="block text-[10px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">
              Title
            </label>
            <input
              type="text"
              class="eg-glass-input text-sm"
              :value="form.title"
              @input="form.title = ($event.target as HTMLInputElement).value"
              maxlength="200"
              placeholder="e.g. December 2026 — Year in Review"
              required
            />
          </div>

          <!-- Subject -->
          <div>
            <label class="block text-[10px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">
              Email subject
            </label>
            <input
              type="text"
              class="eg-glass-input text-sm"
              :value="form.subject"
              @input="form.subject = ($event.target as HTMLInputElement).value"
              maxlength="200"
              placeholder="e.g. Our year in review + what's next"
              required
            />
          </div>

          <!-- Status -->
          <div>
            <label class="block text-[10px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">
              Status
            </label>
            <select class="eg-glass-input text-sm" v-model="form.status">
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="sent">Sent</option>
            </select>
          </div>

          <!-- Scheduled at -->
          <div v-if="form.status === 'scheduled'">
            <label class="block text-[10px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">
              Scheduled at
            </label>
            <input
              type="datetime-local"
              class="eg-glass-input text-sm"
              :value="form.scheduled_at"
              @input="form.scheduled_at = ($event.target as HTMLInputElement).value"
            />
          </div>

          <!-- Recipient list -->
          <div>
            <label class="block text-[10px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">
              Recipients (comma-separated emails)
            </label>
            <input
              type="text"
              class="eg-glass-input text-sm"
              :value="form.recipient_list"
              @input="form.recipient_list = ($event.target as HTMLInputElement).value"
              placeholder="newsletter@earthguardians.org, updates@earthguardians.org"
            />
            <p class="mt-1 text-[10px] text-zinc-500">Leave blank to use the default mailing list.</p>
          </div>

          <!-- Body -->
          <div>
            <label class="block text-[10px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">
              Body (HTML)
            </label>
            <textarea
              class="eg-glass-input text-sm font-mono"
              rows="12"
              :value="form.body"
              @input="form.body = ($event.target as HTMLTextAreaElement).value"
              placeholder="<p>Greetings EG Family!</p>..."
              required
            ></textarea>
            <p class="mt-1 text-[10px] text-zinc-500">{{ form.body.length }} chars.</p>
          </div>

          <div class="mt-4 flex justify-end gap-2">
            <button type="button" class="eg-glass-btn-ghost !px-3 !py-1.5 text-xs" @click="close">
              Cancel
            </button>
            <button
              type="submit"
              class="eg-glass-btn-primary !px-4 !py-1.5 text-xs"
              :disabled="saving || !form.title || !form.subject || !form.body"
            >
              <span v-if="saving" class="flex items-center gap-2">
                <span class="h-3 w-3 animate-spin rounded-full border border-current border-r-transparent" />
                Saving...
              </span>
              <span v-else>Save newsletter</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { Newsletter, NewsletterDraft } from '~/lib/types'
import { computed, reactive, watch } from 'vue'
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

let saving = false

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

  saving = true
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
