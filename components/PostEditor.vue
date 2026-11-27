<template>
  <Transition name="modal">
    <div v-if="open" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/55 backdrop-blur-2xl" aria-hidden="true" @click="close" />

      <div class="eg-sheet absolute inset-0 flex flex-col overflow-hidden sm:inset-4 lg:inset-8">
        <header class="eg-sheet-header">
          <div class="min-w-0">
            <h2 class="text-[15px] font-semibold tracking-tight text-white">{{ post ? 'Edit post' : 'New post' }}</h2>
            <p class="mt-0.5 truncate text-xs text-zinc-500">
              {{ post ? 'Update the scheduled social post' : 'Schedule a new social post' }}
            </p>
          </div>
          <button type="button" class="eg-icon-btn shrink-0" aria-label="Close" @click="close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>

        <!-- Form (left / mobile-first stacked) — Preview (right / desktop side-by-side) -->
        <div ref="paneContainer" class="relative flex flex-col h-full min-w-0 lg:flex-row" :style="dividerStyle">
          <form id="post-editor-form" @submit.prevent="handleSubmit" class="flex-1 min-w-0 overflow-y-auto" :class="{ 'lg:w-full': !previewOpen }">
            <div class="mx-auto w-full max-w-xl space-y-6 px-4 py-6 sm:px-6 lg:max-w-none lg:px-0 lg:py-0">
              <ScheduleSection :form="form" />
              <ClassificationSection :form="form" :topics="topics" />
              <ContentSection :form="form" />
              <MediaSection
                :form="form"
                :media-source="mediaSource"
                :media="media"
                :on-media="onMedia"
                :on-clear-media="clearMedia"
                :on-download-media="downloadMedia"
                :open-gdrive="openGoogleDrivePicker"
                @update:media-source="mediaSource = $event"
              />
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

          <PostPreview
            v-if="previewOpen"
            class="flex-1 min-w-0 overflow-y-auto"
            :form="form"
            :selected-topic="selectedTopic"
            :preview-caption="previewCaption"
            :formatted-hashtags="formattedHashtags"
            :media="media"
            :format-preview-date="formatPreviewDate"
            @hide-preview="previewOpen = false"
          />
        </div>

        <footer class="eg-sheet-footer">
          <button type="button" class="eg-btn-apple-secondary" @click="close">Cancel</button>
          <button type="submit" form="post-editor-form" class="eg-btn-apple-primary" :disabled="saving">
            <span v-if="saving" class="flex items-center gap-2"><span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />Saving…</span>
            <span v-else>{{ post ? 'Save changes' : 'Create post' }}</span>
          </button>
        </footer>
      </div>
    </div>

    <GoogleDrivePicker
      :open="gdrivePickerOpen"
      @select="onGoogleDriveSelect"
      @cancel="onGoogleDriveCancel"
      @update:open="gdrivePickerOpen = $event"
      @update:selectionMode="gdriveSelectionMode = $event"
      :selection-mode="gdriveSelectionMode"
    />
  </Transition>
</template>

<script setup lang="ts">
import type { CalendarPost, PostFormat, PostStatus, Topic } from '~/lib/types'
import { FORMATS, STATUSES } from '~/lib/types'
import { formatBytes, downloadDataUrl, fileToDataUrl, slugify } from '~/lib/image'
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from '~/lib/constants'
import { useSupabaseAuth } from '~/composables/useSupabaseAuth'
import { useToast } from '~/composables/useToast'
import { computed, reactive, ref, watch } from 'vue'
import type { MediaState, MediaSource, PostForm } from './post-editor/types'
import GoogleDrivePicker from '~/components/GoogleDrivePicker.vue'
import ScheduleSection from './post-editor/ScheduleSection.vue'
import ClassificationSection from './post-editor/ClassificationSection.vue'
import ContentSection from './post-editor/ContentSection.vue'
import MediaSection from './post-editor/MediaSection.vue'
import PostPreview from './post-editor/PostPreview.vue'

const props = defineProps<{ open: boolean; post: CalendarPost | null; topics: readonly Topic[]; day: string }>()
const emit = defineEmits<{ save: [draft: any]; delete: [id: string]; cancel: []; 'update:open': [open: boolean] }>()

const { phase } = useSupabaseAuth()
const toast = useToast()

const selectedTopic = computed(() => props.topics.find(t => t.key === form.topic_key) || null)
const previewCaption = computed(() => { const c = form.caption || 'Your caption here...'; return c.length > 80 ? c.slice(0, 80) + '...' : c })
const formattedHashtags = computed(() => { if (!form.hashtags) return ''; return form.hashtags.split(/\s+/).filter(Boolean).map(t => t.startsWith('#') ? t : `#${t}`).join(' ') })

function formatPreviewDate(day: string): string { if (!day) return ''; const d = new Date(day + 'T00:00:00'), n = new Date(), diff = d.getTime() - n.getTime(), days = Math.ceil(diff / 86400000); if (days === 0) return 'Just now'; if (days === 1) return 'Tomorrow'; if (days === -1) return 'Yesterday'; if (days > 1 && days < 7) return `${days} days ago`; return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }

const form = reactive<PostForm>({ id: '', day: '', scheduled_at: null, topic_key: '', format: 'Carousel', status: 'planned', title: '', caption: '', hashtags: '', image_base64: null, video_base64: null })
const saving = ref(false)
const media = reactive<MediaState>({ preview: null, kind: null, bytes: 0, name: '', origin: null })
const mediaSource = ref<MediaSource>('local')
const gdrivePickerOpen = ref(false)
const gdriveSelectionMode = ref<'single' | 'multiple' | 'folder'>('single')

const paneWidth = ref(58)
const previewOpen = ref(true)
const resizing = ref(false)
const paneContainer = ref<HTMLElement | null>(null)

const dividerStyle = computed(() => ({ '--pane-width': `${paneWidth.value}%` }))

function close() { emit('update:open', false) }
watch(() => props.open, (open) => { if (open) resetForm() })

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
  form.image_base64 = post?.image_base64 ?? null
  form.video_base64 = post?.video_base64 ?? null
  media.preview = null
  media.kind = null
  media.bytes = 0
  media.name = ''
  media.origin = null
  if (post?.video_base64) { media.preview = post.video_base64; media.kind = 'video'; media.bytes = post.video_bytes ?? 0; media.name = post.video_name ?? ''; media.origin = 'gdrive' }
  else if (post?.image_base64) { media.preview = post.image_base64; media.kind = 'image'; media.bytes = post.image_bytes ?? 0; media.name = post.image_name ?? ''; media.origin = 'gdrive' }
  mediaSource.value = 'local'
  gdrivePickerOpen.value = false
}

async function onMedia(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const isVideo = file.type.startsWith('video/')
  const isImage = file.type.startsWith('image/')
  if (!isVideo && !isImage) { toast.error('Please choose an image or video file.'); input.value = ''; return }
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (file.size > maxBytes) { toast.error(`${isVideo ? 'Video' : 'Image'} too large (${formatBytes(file.size)}). Limit: ${formatBytes(maxBytes)}.`); input.value = ''; return }
  try {
    const payload = await fileToDataUrl(file, { kind: isVideo ? 'video' : 'image', maxBytes })
    if (isVideo) { form.image_base64 = null; form.video_base64 = payload.base64 } else { form.video_base64 = null; form.image_base64 = payload.base64 }
    media.preview = payload.base64
    media.kind = payload.kind
    media.bytes = payload.bytes
    media.name = file.name
    media.origin = 'local'
  } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not read the file.') } finally { input.value = '' }
}

function clearMedia() {
  form.image_base64 = null
  form.video_base64 = null
  media.preview = null
  media.kind = null
  media.bytes = 0
  media.name = ''
  media.origin = null
}

function downloadMedia() {
  if (!media.preview) return
  const mime = media.preview.match(/data:(.*?);/)![1] ?? 'application/octet-stream'
  const ext = mime.split('/')[1] || (media.kind === 'video' ? 'mp4' : 'jpg')
  downloadDataUrl(media.preview, slugify(`${props.post?.day || 'media'}_${props.post?.topic_key || 'post'}`) + '.' + ext)
}

function openGoogleDrivePicker() { gdriveSelectionMode.value = form.format === 'Carousel' ? 'folder' : 'multiple'; mediaSource.value = 'gdrive'; gdrivePickerOpen.value = true }

function onGoogleDriveSelect(mediaFiles: Array<{ id: string; name: string; mimeType: string; size: number; dataUrl: string; kind: 'image' | 'video' }>) {
  if (mediaFiles.length === 0) return
  const firstFile = mediaFiles[0]
  if (!firstFile) return
  const isVideo = firstFile.kind === 'video'
  if (isVideo) {
    form.image_base64 = null
    form.video_base64 = firstFile.dataUrl
  } else {
    form.video_base64 = null
    form.image_base64 = firstFile.dataUrl
  }
  media.preview = firstFile.dataUrl
  media.kind = firstFile.kind
  media.bytes = firstFile.size
  media.name = firstFile.name
  media.origin = 'gdrive'
  if (mediaFiles.length > 1) {
    const warning = form.format === 'Carousel'
      ? `Carousel: ${mediaFiles.length} files picked — only one media file per post is supported right now, so “${firstFile.name}” was used.`
      : `${mediaFiles.length} files picked — a post holds one media file, so “${firstFile.name}” was used.`
    toast.push(warning, 'info', 7000)
  } else {
    toast.success('Media added from Google Drive.')
  }
  gdrivePickerOpen.value = false
  mediaSource.value = 'gdrive'
}

function onGoogleDriveCancel() {
  gdrivePickerOpen.value = false
  if (media.origin !== 'gdrive') mediaSource.value = 'local'
}

async function handleSubmit() {
  if (!form.topic_key) { toast.error('Please select a topic — every post must be linked to one.'); return }
  const draft: any = { id: form.id || undefined, day: form.day, scheduled_at: form.scheduled_at || null, topic_key: form.topic_key, format: form.format, status: form.status, title: form.title, caption: form.caption, hashtags: form.hashtags }
  if (form.image_base64) { draft.image_base64 = form.image_base64; draft.image_name = 'upload'; draft.image_bytes = media.kind === 'image' ? media.bytes : null }
  else if (props.post) draft.image_base64 = null
  if (form.video_base64) { draft.video_base64 = form.video_base64; draft.video_name = 'upload'; draft.video_bytes = media.kind === 'video' ? media.bytes : null }
  else if (props.post) draft.video_base64 = null
  saving.value = true
  emit('save', draft)
}

async function handleDelete() { if (!props.post?.id) return; if (window.confirm('Delete this post?')) { emit('delete', props.post.id); close() } }

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
