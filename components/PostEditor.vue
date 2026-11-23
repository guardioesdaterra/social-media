<template>
  <Transition name="modal">
    <div v-if="open" class="fixed inset-0 z-50" @click.self="close">
      <div class="absolute inset-0 bg-black/55 backdrop-blur-2xl" aria-hidden="true" />

      <div class="eg-sheet absolute inset-0 flex flex-col overflow-hidden sm:inset-4 lg:inset-8">
        <!-- Header -->
        <header class="eg-sheet-header">
          <div class="min-w-0">
            <h2 class="text-[15px] font-semibold tracking-tight text-white">
              {{ post ? 'Edit post' : 'New post' }}
            </h2>
            <p class="mt-0.5 truncate text-xs text-zinc-500">
              {{ post ? 'Update the scheduled social post' : 'Schedule a new social post' }}
            </p>
          </div>
          <button type="button" class="eg-icon-btn shrink-0" aria-label="Close" @click="close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>

        <!-- Body -->
        <form id="post-editor-form" @submit.prevent="handleSubmit" class="flex-1 overflow-y-auto">
          <div class="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6">
            <!-- Schedule -->
            <section class="eg-section">
              <h3 class="eg-section-title">Schedule</h3>
              <p class="eg-section-sub">When this post should go live.</p>

              <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label class="eg-field-label" for="post-date">Date <span class="req">*</span></label>
                  <input
                    id="post-date"
                    type="date"
                    class="eg-field [color-scheme:dark]"
                    :value="form.day"
                    @input="form.day = ($event.target as HTMLInputElement).value"
                    required
                  />
                </div>
                <div>
                  <label class="eg-field-label" for="post-time">Scheduled time</label>
                  <input
                    id="post-time"
                    type="time"
                    class="eg-field [color-scheme:dark]"
                    :value="form.scheduled_at ?? ''"
                    @input="form.scheduled_at = ($event.target as HTMLInputElement).value || null"
                  />
                  <p class="eg-hint">Leave blank for an all-day post.</p>
                </div>
              </div>
            </section>

            <!-- Classification -->
            <section class="eg-section">
              <h3 class="eg-section-title">Classification</h3>
              <p class="eg-section-sub">Topic, format and workflow status.</p>

              <div class="mt-4 space-y-4">
                <div>
                  <label class="eg-field-label" for="post-topic">Topic <span class="req">*</span></label>
                  <select
                    id="post-topic"
                    class="eg-select"
                    :value="form.topic_key"
                    @change="form.topic_key = ($event.target as HTMLSelectElement).value"
                    required
                  >
                    <option disabled value="">Select a topic</option>
                    <option v-for="t in topics" :key="t.key" :value="t.key">
                      {{ t.emoji }} {{ t.label }}
                    </option>
                  </select>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label class="eg-field-label" for="post-format">Format</label>
                    <select id="post-format" class="eg-select" v-model="form.format">
                      <option v-for="f in FORMATS" :key="f" :value="f">{{ f }}</option>
                    </select>
                  </div>
                  <div>
                    <label class="eg-field-label" for="post-status">Status</label>
                    <select id="post-status" class="eg-select" v-model="form.status">
                      <option v-for="s in STATUSES" :key="s.value" :value="s.value">{{ s.label }}</option>
                    </select>
                  </div>
                </div>
              </div>
            </section>

            <!-- Content -->
            <section class="eg-section">
              <h3 class="eg-section-title">Content</h3>
              <p class="eg-section-sub">What your audience will see.</p>

              <div class="mt-4 space-y-4">
                <div>
                  <label class="eg-field-label" for="post-title">Title</label>
                  <input
                    id="post-title"
                    type="text"
                    class="eg-field"
                    :value="form.title"
                    @input="form.title = ($event.target as HTMLInputElement).value"
                    maxlength="300"
                    placeholder="e.g. Giving Tuesday — matched donation"
                  />
                </div>

                <div>
                  <div class="flex items-baseline justify-between gap-2">
                    <label class="eg-field-label" for="post-caption">Caption</label>
                    <span class="text-[11px] tabular-nums" :class="form.caption.length > 9000 ? 'text-amber-400' : 'text-zinc-600'">
                      {{ form.caption.length }} / 10000
                    </span>
                  </div>
                  <textarea
                    id="post-caption"
                    class="eg-textarea"
                    rows="5"
                    :value="form.caption"
                    @input="form.caption = ($event.target as HTMLTextAreaElement).value"
                    maxlength="10000"
                    placeholder="Greetings EG Family! ..."
                  ></textarea>
                </div>

                <div>
                  <label class="eg-field-label" for="post-tags">Hashtags</label>
                  <input
                    id="post-tags"
                    type="text"
                    class="eg-field"
                    :value="form.hashtags"
                    @input="form.hashtags = ($event.target as HTMLInputElement).value"
                    placeholder="#EarthGuardians #ClimateAction"
                  />
                  <p class="eg-hint">Space-separated.</p>
                </div>
              </div>
            </section>

            <!-- Media -->
            <section class="eg-section">
              <h3 class="eg-section-title">Media</h3>
              <p class="eg-section-sub">Full quality image, stored in Postgres.</p>

              <div class="mt-4 space-y-3">
                <label class="eg-dropzone">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="text-zinc-500"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="1.6" /><path d="m21 15-4.2-4.2a2 2 0 0 0-2.8 0L4 21" /></svg>
                  <span class="text-sm font-medium text-zinc-300">Click to choose an image</span>
                  <span class="text-[11px] text-zinc-500">PNG, JPG or WebP · max 4 MB · replaces any existing image</span>
                  <input type="file" accept="image/*" class="sr-only" @change="onImage" />
                </label>

                <div v-if="imagePreview" class="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <img :src="imagePreview" alt="" class="h-16 w-24 shrink-0 rounded-lg object-cover ring-1 ring-white/10" />
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-xs font-medium text-zinc-200">Current image</p>
                    <p class="mt-0.5 text-[11px] text-zinc-500">{{ formatBytes(imageBytes) }}</p>
                  </div>
                  <button type="button" class="eg-btn-apple-secondary rounded-lg px-3 py-1.5 text-xs" @click="downloadImage">
                    ⤓ Download
                  </button>
                  <button type="button" class="eg-icon-btn text-red-400" aria-label="Remove image" @click="clearImage">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            </section>
          </div>
        </form>

        <!-- Footer -->
        <footer class="eg-sheet-footer">
          <button type="button" class="eg-btn-apple-secondary" @click="close">Cancel</button>
          <button type="submit" form="post-editor-form" class="eg-btn-apple-primary" :disabled="saving">
            <span v-if="saving" class="flex items-center gap-2">
              <span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
              Saving…
            </span>
            <span v-else>{{ post ? 'Save changes' : 'Create post' }}</span>
          </button>
        </footer>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { CalendarPost, PostFormat, PostStatus, Topic } from '~/lib/types'
import { FORMATS, STATUSES } from '~/lib/types'
import { formatBytes, downloadDataUrl, slugify } from '~/lib/image'
import { useSupabaseAuth } from '~/composables/useSupabaseAuth'
import { computed, reactive, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  post: CalendarPost | null
  topics: readonly Topic[]
  day: string
}>()

const emit = defineEmits<{
  save: [draft: any]
  delete: [id: string]
  cancel: []
  'update:open': [open: boolean]
}>()

const { phase } = useSupabaseAuth()
const canEdit = computed(() => phase.value === 'manager')

const form = reactive<{
  id: string
  day: string
  scheduled_at: string | null
  topic_key: string
  format: PostFormat
  status: PostStatus
  title: string
  caption: string
  hashtags: string
  image_base64: string | null
}>({
  id: '',
  day: '',
  scheduled_at: null,
  topic_key: '',
  format: 'Carousel',
  status: 'planned',
  title: '',
  caption: '',
  hashtags: '',
  image_base64: null,
})

const saving = ref(false)

const imagePreview = ref<string | null>(null)
const imageBytes = ref(0)

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
  const post = props.post
  const baseDay = post ? post.day : props.day
  saving.value = false
  form.id = post?.id ?? ''
  form.day = post ? post.day : baseDay
  form.scheduled_at = post?.scheduled_at ?? null
  form.topic_key = post?.topic_key ?? ''
  form.format = (post?.format ?? 'Carousel') as PostFormat
  form.status = (post?.status ?? 'planned') as PostStatus
  form.title = post?.title ?? ''
  form.caption = post?.caption ?? ''
  form.hashtags = post?.hashtags ?? ''
  imagePreview.value = post?.image_base64 ?? null
  imageBytes.value = post?.image_bytes ?? 0
}

function onImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = String(reader.result || '')
    form.image_base64 = dataUrl
    imagePreview.value = dataUrl
    imageBytes.value = Math.floor(((dataUrl.split(',')[1] || '').length * 3) / 4)
  }
  reader.readAsDataURL(file)
}

function clearImage() {
  form.image_base64 = null
  imagePreview.value = null
  imageBytes.value = 0
}

async function downloadImage() {
  if (!props.post?.image_base64) return
  const mime = props.post.image_mime?.split('/')[1] || 'jpg'
  downloadDataUrl(props.post.image_base64, slugify(`${props.post.day}_${props.post.topic_key}`) + '.' + mime)
}

async function handleSubmit() {
  if (!form.topic_key) {
    alert('Please select a topic — every post must be linked to one.')
    return
  }

  const draft: any = {
    id: form.id || undefined,
    day: form.day,
    scheduled_at: form.scheduled_at || null,
    topic_key: form.topic_key,
    format: form.format,
    status: form.status,
    title: form.title,
    caption: form.caption,
    hashtags: form.hashtags,
  }

  if (form.image_base64) {
    draft.image_base64 = form.image_base64
    draft.image_name = 'upload'
    draft.image_bytes = imageBytes.value
  } else if (props.post) {
    // explicit clear when editing and image removed
    draft.image_base64 = null
  }

  saving.value = true
  emit('save', draft)
  // Do not close here: the parent closes the modal after the save promise
  // resolves. Closing now would lose the form if the server rejects it.
}

async function handleDelete() {
  if (!props.post?.id) return
  if (window.confirm('Delete this post?')) {
    emit('delete', props.post.id)
    close()
  }
}
</script>
