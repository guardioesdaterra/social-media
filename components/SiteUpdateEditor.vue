<template>
  <Transition name="modal">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="close">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div class="relative w-full max-w-2xl bg-[var(--eg-panel)] border border-[var(--eg-border)] rounded-xl shadow-2xl flex flex-col">
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

        <form @submit.prevent="handleSubmit" class="p-4 space-y-3">
          <!-- Title -->
          <div>
            <label class="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">
              Title
            </label>
            <input
              type="text"
              class="eg-input text-sm"
              :value="form.title"
              @input="form.title = $event.target.value"
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
              @input="form.slug = $event.target.value"
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
              @input="form.published_at = $event.target.value"
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
              @input="form.url = $event.target.value"
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
              @input="form.content = $event.target.value"
              placeholder="<h1>Welcome</h1><p>...</p>"
              required
            ></textarea>
            <p class="mt-1 text-[10px] text-zinc-600">{{ form.content.length }} chars.</p>
          </div>

          <div class="mt-4 flex justify-end gap-2">
            <button type="button" class="eg-btn-ghost !px-3 !py-1.5 text-xs" @click="close">
              Cancel
            </button>
            <button type="submit" class="eg-btn-primary !px-4 !py-1.5 text-xs" :disabled="saving">
              Save site update
            </button>
          </div>
        </form>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { SiteUpdate, SiteUpdateDraft } from '~/lib/types'
import { computed, reactive, watch } from 'vue'
import { useSupabaseAuth } from '~/composables/useSupabaseAuth'

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
  const u = props.siteUpdate
  form.id = u?.id ?? ''
  form.title = u?.title ?? ''
  form.slug = u?.slug ?? ''
  form.content = u?.content ?? ''
  form.status = (u?.status ?? 'draft') as 'draft' | 'published' | 'archived'
  form.published_at = u?.published_at ? u.published_at.slice(0, 16) : ''
  form.url = u?.url ?? ''
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
  }

  saving = true
  emit('save', draft)
  close()
  saving = false
}

async function handleDelete() {
  if (!props.siteUpdate?.id) return
  if (window.confirm('Delete this site update?')) {
    emit('delete', props.siteUpdate.id)
    close()
  }
}
</script>
