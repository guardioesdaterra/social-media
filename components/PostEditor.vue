<template>
  <Transition name="modal">
    <div v-if="open" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/55 backdrop-blur-2xl" aria-hidden="true" @click="close" />

      <div class="eg-sheet absolute inset-0 flex flex-col overflow-hidden sm:inset-4 lg:inset-8">
        <header class="eg-sheet-header">
          <div class="min-w-0">
            <h2 class="text-[15px] font-semibold tracking-tight text-white">
              {{ reviewMode ? 'View post' : (post ? 'Edit post' : 'New post') }}
            </h2>
            <p class="mt-0.5 truncate text-xs text-zinc-500">
              {{ reviewMode ? 'Review and optionally edit this post' : (post ? 'Update the scheduled social post' : 'Schedule a new social post') }}
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <!-- Edit button in review mode -->
            <button
              v-if="reviewMode && !editing"
              type="button"
              class="eg-btn-apple-secondary text-xs"
              @click="editing = true"
            >
              Edit
            </button>
            <button type="button" class="eg-icon-btn shrink-0" aria-label="Close" @click="close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </header>

        <!-- Form (left / mobile-first stacked) — Preview (right / desktop side-by-side) -->
        <div ref="paneContainer" class="relative flex min-h-0 flex-1 min-w-0 flex-col lg:flex-row" :style="dividerStyle">
          <form id="post-editor-form" @submit.prevent="handleSubmit" class="flex-1 min-w-0 overflow-y-auto" :class="{ 'lg:w-full': !previewOpen }">
            <div class="mx-auto w-full max-w-xl space-y-6 px-4 py-6 sm:px-6 lg:max-w-none lg:px-0 lg:py-0">
              <ScheduleSection :form="form" :readonly="reviewMode && !editing" />
              <ClassificationSection :form="form" :topics="topics" :readonly="reviewMode && !editing" />
              <ContentSection :form="form" :readonly="reviewMode && !editing" />
              <MediaSection
                :form="form"
                :media-source="mediaSource"
                :media="media"
                :on-media="onMedia"
                :on-clear-media="clearMedia"
                :on-remove-slide="removeSlide"
                :on-download-media="downloadMedia"
                :open-gdrive="openGoogleDrivePicker"
                :readonly="reviewMode && !editing"
                @update:media-source="mediaSource = $event"
              />
              <div v-if="!previewOpen && (!reviewMode || editing)" class="mt-4 flex justify-center">
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
          <button
            v-if="!reviewMode || editing"
            type="submit"
            form="post-editor-form"
            class="eg-btn-apple-primary"
            :disabled="saving"
          >
            <span v-if="saving" class="flex items-center gap-2"><span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />Saving…</span>
            <span v-else>{{ reviewMode ? 'Save changes' : (post ? 'Save changes' : 'Create post') }}</span>
          </button>
          <button
            v-else
            type="button"
            class="eg-btn-apple-secondary"
            @click="editing = true"
          >
            Edit post
          </button>
        </footer>
      </div>
    </div>
  </Transition>

  <!-- Sibling of the sheet (never inside <Transition>): it must stack above the editor. -->
  <GoogleDrivePicker
    :open="gdrivePickerOpen"
    @select="onGoogleDriveSelect"
    @cancel="onGoogleDriveCancel"
    @update:open="gdrivePickerOpen = $event"
    @update:selectionMode="gdriveSelectionMode = $event"
    :selection-mode="gdriveSelectionMode"
  />
</template>

<script setup lang="ts">
import type { CalendarPost, PostFormat, PostStatus, Topic } from '~/lib/types'
import { FORMATS, STATUSES } from '~/lib/types'
import { formatBytes, downloadDataUrl, fileToDataUrl, slugify } from '~/lib/image'
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, MAX_CAROUSEL_IMAGES } from '~/lib/constants'
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

const props = defineProps<{ open: boolean; post: CalendarPost | null; topics: readonly Topic[]; day: string; reviewMode?: boolean }>()
const emit = defineEmits<{ save: [draft: any]; delete: [id: string]; cancel: []; 'update:open': [open: boolean] }>()

const { phase } = useSupabaseAuth()
const toast = useToast()

const selectedTopic = computed(() => props.topics.find(t => t.key === form.topic_key) || null)
const previewCaption = computed(() => { const c = form.caption || 'Your caption here...'; return c.length > 80 ? c.slice(0, 80) + '...' : c })
const formattedHashtags = computed(() => { if (!form.hashtags) return ''; return form.hashtags.split(/\s+/).filter(Boolean).map(t => t.startsWith('#') ? t : `#${t}`).join(' ') })

function formatPreviewDate(day: string): string { if (!day) return ''; const d = new Date(day + 'T00:00:00'), n = new Date(), diff = d.getTime() - n.getTime(), days = Math.ceil(diff / 86400000); if (days === 0) return 'Just now'; if (days === 1) return 'Tomorrow'; if (days === -1) return 'Yesterday'; if (days > 1 && days < 7) return `${days} days ago`; return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }

const form = reactive<PostForm>({ id: '', day: '', scheduled_at: null, topic_key: '', format: 'Carousel', status: 'planned', title: '', caption: '', hashtags: '', image_base64: null, video_base64: null, image_slides: [] })
const saving = ref(false)
const media = reactive<MediaState>({ preview: null, kind: null, bytes: 0, name: '', origin: null, slides: [] })
const mediaSource = ref<MediaSource>('local')
const gdrivePickerOpen = ref(false)
const gdriveSelectionMode = ref<'single' | 'multiple' | 'folder'>('single')

const paneWidth = ref(58)
/** Side-by-side preview only helps on wide screens; phones open on the form. */
const previewOpen = ref(typeof window === 'undefined' || window.innerWidth >= 1024)
const resizing = ref(false)
const paneContainer = ref<HTMLElement | null>(null)
const editing = ref(false)

const dividerStyle = computed(() => ({ '--pane-width': `${paneWidth.value}%` }))

function close() { emit('update:open', false) }
watch(() => props.open, (open) => { if (open) { resetForm(); editing.value = false } })

// Only a Carousel holds several images: switching away keeps the cover slide.
watch(() => form.format, (format) => {
  if (format === 'Carousel' || form.image_slides.length <= 1) return
  const cover = form.image_slides[0]
  if (!cover) return
  const name = /^\d+ images$/.test(media.name) ? 'upload' : media.name
  applyImageSlides([cover], name, media.origin ?? 'local', media.bytes)
  toast.push(`${format} posts hold a single media file — the first image was kept.`, 'info', 6000)
})

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
  form.image_slides = []
  media.preview = null
  media.kind = null
  media.bytes = 0
  media.name = ''
  media.origin = null
  media.slides = []
  if (post?.video_base64) { media.preview = post.video_base64; media.kind = 'video'; media.bytes = post.video_bytes ?? 0; media.name = post.video_name ?? ''; media.origin = 'gdrive' }
  else if (post?.image_base64) {
    const slides = (post.image_slides?.length ? post.image_slides : [post.image_base64]).filter((s): s is string => !!s)
    form.image_slides = [...slides]
    form.image_base64 = slides[0] ?? post.image_base64
    media.preview = slides[0] ?? post.image_base64
    media.kind = 'image'
    media.bytes = post.image_bytes ?? 0
    media.name = slides.length > 1 ? `${slides.length} images` : (post.image_name ?? '')
    media.origin = 'gdrive'
    media.slides = [...slides]
  }
  mediaSource.value = 'local'
  gdrivePickerOpen.value = false
}

/** Replaces the current media with the given image slides (cover = first). */
function applyImageSlides(slides: string[], name: string, origin: 'local' | 'gdrive', bytes: number) {
  form.video_base64 = null
  form.image_base64 = slides[0] ?? null
  form.image_slides = [...slides]
  media.preview = slides[0] ?? null
  media.kind = 'image'
  media.bytes = bytes
  media.name = name
  media.origin = origin
  media.slides = [...slides]
}

/** Replaces the current media with a single video (a video post never has slides). */
function applyVideo(base64: string, name: string, bytes: number, origin: 'local' | 'gdrive') {
  form.image_base64 = null
  form.video_base64 = base64
  form.image_slides = []
  media.preview = base64
  media.kind = 'video'
  media.bytes = bytes
  media.name = name
  media.origin = origin
  media.slides = []
}

/**
 * Picks what the current format may hold: a Carousel keeps every image (videos are
 * never slides), every other format keeps a single media file.
 */
function selectForFormat<T extends { name: string; kind: 'image' | 'video' }>(files: T[]): { accepted: T[]; note: string | null } {
  const first = files[0]
  if (!first) return { accepted: [], note: null }

  if (form.format !== 'Carousel') {
    const accepted = files.slice(0, 1)
    const note = files.length > 1
      ? `${files.length} files picked — a ${form.format} post holds one media file, so “${first.name}” was used.`
      : null
    return { accepted, note }
  }

  const images = files.filter(f => f.kind === 'image')
  if (images.length === 0) {
    // No images at all (video folder): keep the first video.
    return { accepted: files.slice(0, 1), note: files.length > 1 ? `${files.length} files picked — a video post holds a single media file, so “${first.name}” was used.` : null }
  }

  const accepted = images.slice(0, MAX_CAROUSEL_IMAGES)
  const skippedVideos = files.length - images.length
  const skippedExtra = images.length - accepted.length
  const note = skippedVideos > 0
    ? `${skippedVideos} video file${skippedVideos === 1 ? '' : 's'} skipped — a carousel holds images only.`
    : skippedExtra > 0
      ? `A carousel holds up to ${MAX_CAROUSEL_IMAGES} images — the first ${MAX_CAROUSEL_IMAGES} were kept.`
      : null
  return { accepted, note }
}

async function onMedia(event: Event) {
  const input = event.target as HTMLInputElement
  const picked = Array.from(input.files ?? [])
  input.value = ''
  if (picked.length === 0) return

  const isVideo = (f: File) => f.type.startsWith('video/')
  const isImage = (f: File) => f.type.startsWith('image/')
  if (picked.some(f => !isVideo(f) && !isImage(f))) { toast.error('Please choose an image or video file.'); return }

  const { accepted, note } = selectForFormat(picked.map(file => ({ file, name: file.name, kind: (isImage(file) ? 'image' : 'video') as 'image' | 'video' })))
  const first = accepted[0]
  if (!first) return
  if (note) toast.push(note, 'info', 6000)

  for (const item of accepted) {
    const maxBytes = isVideo(item.file) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
    if (item.file.size > maxBytes) { toast.error(`${isVideo(item.file) ? 'Video' : 'Image'} too large (${formatBytes(item.file.size)}). Limit: ${formatBytes(maxBytes)}.`); return }
  }

  try {
    if (first.kind === 'video') {
      const payload = await fileToDataUrl(first.file, { kind: 'video', maxBytes: MAX_VIDEO_BYTES })
      applyVideo(payload.base64, first.name, payload.bytes, 'local')
      return
    }
    const slides: string[] = []
    let bytes = 0
    for (const item of accepted) {
      const payload = await fileToDataUrl(item.file, { kind: 'image', maxBytes: MAX_IMAGE_BYTES })
      slides.push(payload.base64)
      bytes += payload.bytes
    }
    applyImageSlides(slides, slides.length > 1 ? `${slides.length} images` : first.name, 'local', bytes)
  } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not read the file.') }
}

function clearMedia() {
  form.image_base64 = null
  form.video_base64 = null
  form.image_slides = []
  media.preview = null
  media.kind = null
  media.bytes = 0
  media.name = ''
  media.origin = null
  media.slides = []
}

/** Drops one slide from the carousel; removing the last one clears the media. */
function removeSlide(index: number) {
  const slides = media.slides.filter((_, i) => i !== index)
  if (slides.length === 0) { clearMedia(); return }
  const name = slides.length > 1 ? `${slides.length} images` : (/^\d+ images$/.test(media.name) ? 'upload' : media.name)
  applyImageSlides(slides, name, media.origin ?? 'local', media.bytes)
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
  const { accepted, note } = selectForFormat(mediaFiles)
  const firstFile = accepted[0]
  if (!firstFile) return

  if (firstFile.kind === 'video') {
    applyVideo(firstFile.dataUrl, firstFile.name, firstFile.size, 'gdrive')
  } else {
    applyImageSlides(
      accepted.map(f => f.dataUrl),
      accepted.length > 1 ? `${accepted.length} images` : firstFile.name,
      'gdrive',
      accepted.reduce((total, f) => total + f.size, 0),
    )
  }
  if (note) toast.push(note, 'info', 6000)
  else if (firstFile.kind === 'image' && accepted.length > 1) toast.success(`${accepted.length} images added from Google Drive.`)
  else toast.success('Media added from Google Drive.')

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
  if (form.image_slides.length > 1) draft.image_slides = [...form.image_slides]
  else if (props.post) draft.image_slides = null
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
