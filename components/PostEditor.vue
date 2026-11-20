<template>
  <Transition name="modal">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="close">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div class="relative w-full max-w-lg bg-[var(--eg-panel)] border border-[var(--eg-border)] rounded-xl shadow-2xl flex flex-col">
        <div class="flex items-center justify-between gap-3 border-b border-[var(--eg-border)] px-4 py-3">
          <h2 class="text-sm font-semibold text-white">
            {{ editorPost ? 'Edit post' : 'New post' }}
          </h2>
          <button class="eg-btn-ghost !px-1.5 !py-1 text-[10px] text-zinc-400 hover:text-white" @click="close">
            ✕
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="p-4 space-y-3">
          <!-- Day -->
          <div>
            <label class="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">Date</label>
            <input
              type="date"
              class="eg-input text-sm"
              :value="form.day"
              @input="form.day = $event.target.value"
              required
            />
          </div>

          <!-- Topic (REQUIRED) -->
          <div>
            <label class="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">Topic <span class="text-red-400">*</span></label>
            <select
              class="eg-input text-sm"
              :value="form.topic_key"
              @change="form.topic_key = $event.target.value"
              required
            >
              <option disabled value="">Select a topic</option>
              <option v-for="t in topics" :key="t.key" :value="t.key">
                {{ t.emoji }} {{ t.label }}
              </option>
            </select>
          </div>

          <!-- Format & Status -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">Format</label>
              <select class="eg-input text-sm" v-model="form.format">
                <option v-for="f in FORMATS" :key="f" :value="f">{{ f }}</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">Status</label>
              <select class="eg-input text-sm" v-model="form.status">
                <option v-for="s in STATUSES" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </div>
          </div>

          <!-- Title -->
          <div>
            <label class="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">Title</label>
            <input
              type="text"
              class="eg-input text-sm"
              :value="form.title"
              @input="form.title = $event.target.value"
              maxlength="300"
              placeholder="e.g. Giving Tuesday — matched donation"
            />
          </div>

          <!-- Caption -->
          <div>
            <label class="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">Caption</label>
            <textarea
              class="eg-input text-sm"
              rows="4"
              :value="form.caption"
              @input="form.caption = $event.target.value"
              maxlength="10000"
              placeholder="Greetings EG Family! ..."
            ></textarea>
            <p class="mt-1 text-[10px] text-zinc-600">{{ form.caption.length }} / 10000</p>
          </div>

          <!-- Hashtags -->
          <div>
            <label class="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">Hashtags</label>
            <input
              type="text"
              class="eg-input text-sm"
              :value="form.hashtags"
              @input="form.hashtags = $event.target.value"
              placeholder="#EarthGuardians #ClimateAction"
            />
            <p class="mt-1 text-[10px] text-zinc-600">Space-separated.</p>
          </div>

          <!-- Image (base64, full quality) -->
          <div class="pt-2 border-t border-[var(--eg-border)]">
            <label class="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">Image (full quality, stored in Postgres)</label>
            <input type="file" accept="image/*" class="block w-full text-sm text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-[var(--eg-accent)] file:text-black hover:file:bg-[var(--eg-accent)]/90" @change="onImage" />
            <p class="mt-1 text-[10px] text-zinc-500">Max 4 MB. Replaces any existing image.</p>

            <div v-if="imagePreview" class="mt-2 relative">
              <img :src="imagePreview" alt="" class="h-24 w-32 rounded object-cover border border-[var(--eg-border)]" />
              <div class="absolute -top-2 -right-2 bg-red-950/90 text-[10px] px-1.5 py-0.5 rounded text-red-100">
                {{ formatBytes(imageBytes) }}
              </div>
              <button
                class="absolute -top-2 -right-2 z-10 eg-btn-ghost !px-1.5 !py-1 text-[10px] text-red-400 hover:text-red-300"
                @click="clearImage"
              >
                ✕
              </button>
              <button
                class="mt-2 eg-btn-ghost !px-3 !py-1 text-[10px] text-zinc-400 hover:text-zinc-200"
                @click="downloadImage"
              >
                ⤓ Download full quality
              </button>
            </div>
          </div>

          <div class="mt-4 flex justify-end gap-2">
            <button type="button" class="eg-btn-ghost !px-3 !py-1.5 text-xs" @click="close">Cancel</button>
            <button type="submit" class="eg-btn-primary !px-4 !py-1.5 text-xs" :disabled="saving">Save post</button>
          </div>
        </form>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { CalendarPost, PostFormat, PostStatus, Topic } from '~/lib/types'
import { FORMATS, STATUSES } from '~/lib/types'
import { formatBytes, downloadDataUrl, slugify } from '~/lib/image'
import { useSupabaseAuth } from '~/composables/useSupabaseAuth'
import { computed, reactive, watch } from 'vue'

const props = defineProps<{
  open: boolean
  post: CalendarPost | null
  topics: Topic[]
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
  topic_key: '',
  format: 'Carousel',
  status: 'planned',
  title: '',
  caption: '',
  hashtags: '',
  image_base64: null,
})

let imagePreview: string | null = null
let imageBytes = 0

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
  form.id = post?.id ?? ''
  form.day = post ? post.day : baseDay
  form.topic_key = post?.topic_key ?? ''
  form.format = (post?.format ?? 'Carousel') as PostFormat
  form.status = (post?.status ?? 'planned') as PostStatus
  form.title = post?.title ?? ''
  form.caption = post?.caption ?? ''
  form.hashtags = post?.hashtags ?? ''
  imagePreview = post?.image_base64 ?? null
  imageBytes = post?.image_bytes ?? 0
}

function onImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = String(reader.result || '')
    form.image_base64 = dataUrl
    imagePreview = dataUrl
    imageBytes = Math.floor(((dataUrl.split(',')[1] || '').length * 3) / 4)
  }
  reader.readAsDataURL(file)
}

function clearImage() {
  form.image_base64 = null
  imagePreview = null
  imageBytes = 0
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
    draft.image_bytes = imageBytes
  } else if (props.post) {
    // explicit clear when editing and image removed
    draft.image_base64 = null
  }

  emit('save', draft)
  close()
}

async function handleDelete() {
  if (!props.post?.id) return
  if (window.confirm('Delete this post?')) {
    emit('delete', props.post.id)
    close()
  }
}
</script>
