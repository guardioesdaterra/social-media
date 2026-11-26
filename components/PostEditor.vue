<template>
  <Transition name="modal">
    <div v-if="open" class="fixed inset-0 z-50" @click.self="close">
      <div class="absolute inset-0 bg-black/55 backdrop-blur-2xl" aria-hidden="true" />
      
      <div class="eg-sheet absolute inset-0 flex flex-col overflow-hidden sm:inset-4 lg:inset-8">
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

        <div class="flex flex-1 overflow-hidden">
          <form id="post-editor-form" @submit.prevent="handleSubmit" class="flex-1 overflow-y-auto">
            <div class="mx-auto w-full max-w-2xl space-y-5 px-4 py-6 sm:px-6">
              <section class="eg-section">
                <h3 class="eg-section-title">Schedule</h3>
                <p class="eg-section-sub">When this post should go live.</p>
                <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label class="eg-field-label" for="post-date">Date <span class="req">*</span></label>
                    <input id="post-date" type="date" class="eg-field [color-scheme:dark]" :value="form.day" @input="form.day = ($event.target as HTMLInputElement).value" required />
                  </div>
                  <div>
                    <label class="eg-field-label" for="post-time">Scheduled time</label>
                    <input id="post-time" type="time" class="eg-field [color-scheme:dark]" :value="form.scheduled_at ?? ''" @input="form.scheduled_at = ($event.target as HTMLInputElement).value || null" />
                    <p class="eg-hint">Leave blank for an all-day post.</p>
                  </div>
                </div>
              </section>

              <section class="eg-section">
                <h3 class="eg-section-title">Classification</h3>
                <p class="eg-section-sub">Topic, format and workflow status.</p>
                <div class="mt-4 space-y-4">
                  <div>
                    <label class="eg-field-label" for="post-topic">Topic <span class="req">*</span></label>
                    <select id="post-topic" class="eg-select" :value="form.topic_key" @change="form.topic_key = ($event.target as HTMLSelectElement).value" required>
                      <option disabled value="">Select a topic</option>
                      <option v-for="t in topics" :key="t.key" :value="t.key">{{ t.emoji }} {{ t.label }}</option>
                    </select>
                  </div>
                  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label class="eg-field-label" for="post-format">Format</label>
                      <select id="post-format" class="eg-select" v-model="form.format"><option v-for="f in FORMATS" :key="f" :value="f">{{ f }}</option></select>
                    </div>
                    <div>
                      <label class="eg-field-label" for="post-status">Status</label>
                      <select id="post-status" class="eg-select" v-model="form.status"><option v-for="s in STATUSES" :key="s.value" :value="s.value">{{ s.label }}</option></select>
                    </div>
                  </div>
                </div>
              </section>

              <section class="eg-section">
                <h3 class="eg-section-title">Content</h3>
                <p class="eg-section-sub">What your audience will see.</p>
                <div class="mt-4 space-y-4">
                  <div>
                    <label class="eg-field-label" for="post-title">Title</label>
                    <input id="post-title" type="text" class="eg-field" :value="form.title" @input="form.title = ($event.target as HTMLInputElement).value" maxlength="300" placeholder="e.g. Giving Tuesday — matched donation" />
                  </div>
                  <div>
                    <div class="flex items-baseline justify-between gap-2">
                      <label class="eg-field-label" for="post-caption">Caption</label>
                      <span class="text-[11px] tabular-nums" :class="form.caption.length > 9000 ? 'text-amber-400' : 'text-zinc-600'">{{ form.caption.length }} / 10000</span>
                    </div>
                    <textarea id="post-caption" class="eg-textarea" rows="5" :value="form.caption" @input="form.caption = ($event.target as HTMLTextAreaElement).value" maxlength="10000" placeholder="Greetings EG Family! ..."></textarea>
                  </div>
                  <div>
                    <label class="eg-field-label" for="post-tags">Hashtags</label>
                    <input id="post-tags" type="text" class="eg-field" :value="form.hashtags" @input="form.hashtags = ($event.target as HTMLInputElement).value" placeholder="#EarthGuardians #ClimateAction" />
                    <p class="eg-hint">Space-separated.</p>
                  </div>
                </div>
              </section>

              <section class="eg-section">
                <h3 class="eg-section-title">Media</h3>
                <p class="eg-section-sub">Full quality image or video, stored in Postgres.</p>
                <div class="mt-4 space-y-3">
                  <div class="eg-segmented mt-2" role="tablist" aria-label="Media source">
                    <button type="button" role="tab" :aria-selected="mediaSource === 'local'" :class="['eg-segmented-item', mediaSource === 'local' ? 'is-active' : '']" @click="mediaSource = 'local'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>Local Upload</button>
                    <button type="button" role="tab" :aria-selected="mediaSource === 'gdrive'" :class="['eg-segmented-item', mediaSource === 'gdrive' ? 'is-active' : '']" @click="openGoogleDrivePicker"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="mr-1.5"><path d="M19.5 9c0-2.48-2.02-4.5-4.5-4.5S10.5 6.52 10.5 9"/><path d="M12 16.5c-2.48 0-4.5-2.02-4.5-4.5S9.5 7.5 12 7.5s4.5 2.02 4.5 4.5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M21 15h-2.5a1.5 1.5 0 0 1-1.5-1.5V12a1.5 1.5 0 0 0-1.5-1.5H12"/></svg>Google Drive</button>
                  </div>

                  <div v-if="mediaSource === 'local'" class="mt-2 space-y-3">
                    <label class="eg-dropzone"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="text-zinc-500"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="1.6" /><path d="m21 15-4.2-4.2a2 2 0 0 0-2.8 0L4 21" /></svg><span class="text-sm font-medium text-zinc-300">Click to choose an image or video</span><span class="text-[11px] text-zinc-500">PNG, JPG or WebP (max 4 MB) · MP4 or MOV (max 100 MB) · replaces any existing media</span><input type="file" accept="image/*,video/*" class="sr-only" @change="onMedia" /></label>
                  </div>

                  <div v-else class="mt-2">
                    <div class="rounded-xl p-4 mb-3 bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="text-emerald-400 flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-white">Select from Google Drive</p>
                        <p class="text-xs text-zinc-400 mt-0.5">Browse folders to pick a single file, multiple files, or an entire folder (all images/videos for carousel).</p>
                      </div>
                    </div>
                    <button type="button" class="eg-btn-apple-secondary w-full" @click="openGoogleDrivePicker"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-2"><path d="M21 15V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v10"/><path d="M3 15v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V15"/></svg>Open Google Drive Picker</button>
                  </div>

                  <div v-if="mediaPreview" class="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <template v-if="mediaKind === 'video'"><video :src="mediaPreview" alt="" class="h-16 w-24 shrink-0 rounded-lg object-cover ring-1 ring-white/10" muted playsinline /></template>
                    <template v-else><img :src="mediaPreview" alt="" class="h-16 w-24 shrink-0 rounded-lg object-cover ring-1 ring-white/10" /></template>
                    <div class="min-w-0 flex-1"><p class="truncate text-xs font-medium text-zinc-200">Current {{ mediaKind }}</p><p class="mt-0.5 text-[11px] text-zinc-500">{{ formatBytes(mediaBytes) }}</p></div>
                    <button type="button" class="eg-btn-apple-secondary rounded-lg px-3 py-1.5 text-xs" @click="downloadMedia">⤓ Download</button>
                    <button type="button" class="eg-icon-btn text-red-400" aria-label="Remove media" @click="clearMedia"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
                  </div>
                </div>
              </section>
            </div>
          </form>

          <div class="hidden lg:flex w-1/2 min-w-[400px] max-w-[540px] border-l border-white/08 bg-[#0a0a0a] flex-col">
            <div class="shrink-0 border-b border-white/08 px-6 py-4">
              <div class="flex items-center justify-between"><h3 class="text-[13px] font-semibold text-white">Preview</h3><div class="flex items-center gap-2 rounded-lg bg-white/05 px-3 py-1.5"><span class="text-[11px] text-zinc-400">Format:</span><span class="text-xs font-medium text-white">{{ form.format }}</span></div></div>
            </div>
            <div class="flex-1 overflow-y-auto p-6">
              <div class="mx-auto max-w-[350px] overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl">
                <div class="flex items-center gap-3 px-3 py-3"><div class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 text-sm font-bold text-black">{{ selectedTopic?.emoji || '📷' }}</div><div class="flex-1 min-w-0"><p class="truncate text-[13px] font-semibold text-white">{{ selectedTopic?.label || 'earthguardians' }}</p><p class="truncate text-[11px] text-zinc-500">{{ form.scheduled_at ? `${form.day} at ${form.scheduled_at}` : form.day }}</p></div><button type="button" class="text-zinc-400 hover:text-white transition"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="5" cy="12" r="2"/></svg></button></div>
                <div class="relative aspect-square bg-zinc-900">
                  <template v-if="mediaPreview"><template v-if="mediaKind === 'video'"><video :src="mediaPreview" alt="Post media" class="h-full w-full object-cover" muted playsinline /></template><template v-else><img :src="mediaPreview" alt="Post media" class="h-full w-full object-cover" /></template><div v-if="form.format === 'Reel' || form.format === 'Video'" class="absolute bottom-3 left-3 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 backdrop-blur-sm"><svg width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg><span class="text-[10px] font-medium text-white">{{ form.format }}</span></div><div v-if="form.format === 'Carousel'" class="absolute bottom-3 left-3 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 backdrop-blur-sm"><span class="text-[10px] font-medium text-white">1/3</span></div></template><template v-else><div class="flex h-full flex-col items-center justify-center gap-3 text-zinc-600"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-4.2-4.2a2 2 0 0 0-2.8 0L4 21"/></svg><span class="text-xs">No image selected</span></div></template>
                </div>
                <div class="flex items-center justify-between px-3 py-3"><div class="flex items-center gap-4"><button type="button" class="text-zinc-400 hover:text-white transition"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></button><button type="button" class="text-zinc-400 hover:text-white transition"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button><button type="button" class="text-zinc-400 hover:text-white transition"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button></div><button type="button" class="text-zinc-400 hover:text-white transition"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div>
                <div class="px-3 pb-1"><p class="text-[13px] font-semibold text-white">1,234 likes</p></div>
                <div class="px-3 py-2"><p class="text-[13px] text-white"><span class="font-semibold">{{ selectedTopic?.label || 'earthguardians' }}</span><span class="ml-1">{{ previewCaption }}</span></p></div>
                <div v-if="form.hashtags" class="px-3 pb-3"><p class="text-[13px] text-blue-400">{{ formattedHashtags }}</p></div>
                <div class="px-3 pb-3"><button type="button" class="text-[13px] text-zinc-500 hover:text-zinc-300 transition">View all comments</button></div>
                <div class="border-t border-white/08 px-3 py-2"><p class="text-[10px] uppercase tracking-wider text-zinc-500">{{ formatPreviewDate(form.day) }}</p></div>
              </div>
              <div v-if="form.format === 'Story'" class="mt-6"><h4 class="mb-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider">Story Preview</h4><div class="mx-auto aspect-[9/16] max-w-[250px] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl"><template v-if="mediaPreview"><template v-if="mediaKind === 'video'"><video :src="mediaPreview" alt="Story media" class="h-full w-full object-cover" muted playsinline /></template><template v-else><img :src="mediaPreview" alt="Story media" class="h-full w-full object-cover" /></template><div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4"><p class="text-sm font-medium text-white truncate">{{ form.title || selectedTopic?.label }}</p></div></template><template v-else><div class="flex h-full flex-col items-center justify-center gap-2 text-zinc-600"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg><span class="text-xs">Story content</span></div></template></div></div>
            </div>
            <div class="shrink-0 border-t border-white/08 bg-white/[0.02] px-6 py-3"><p class="text-[11px] text-zinc-500"><span class="text-zinc-400">Tip:</span> This is a preview. Actual appearance may vary by platform.</p></div>
          </div>
        </div>

        <footer class="eg-sheet-footer"><button type="button" class="eg-btn-apple-secondary" @click="close">Cancel</button><button type="submit" form="post-editor-form" class="eg-btn-apple-primary" :disabled="saving"><span v-if="saving" class="flex items-center gap-2"><span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />Saving…</span><span v-else>{{ post ? 'Save changes' : 'Create post' }}</span></button></footer>
      </div>
    </div>
  </Transition>

  <GoogleDrivePicker v-if="gdrivePickerOpen" :open="gdrivePickerOpen" @select="onGoogleDriveSelect" @cancel="gdrivePickerOpen = false" @update:open="gdrivePickerOpen = $event" @update:selectionMode="gdriveSelectionMode = $event" :selection-mode="gdriveSelectionMode" />
</template>

<script setup lang="ts">
import type { CalendarPost, PostFormat, PostStatus, Topic } from '~/lib/types'
import { FORMATS, STATUSES } from '~/lib/types'
import { formatBytes, downloadDataUrl, fileToDataUrl, slugify } from '~/lib/image'
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from '~/lib/constants'
import { useSupabaseAuth } from '~/composables/useSupabaseAuth'
import { computed, reactive, ref, watch } from 'vue'
import GoogleDrivePicker from '~/components/GoogleDrivePicker.vue'

const props = defineProps<{ open: boolean; post: CalendarPost | null; topics: readonly Topic[]; day: string }>()
const emit = defineEmits<{ save: [draft: any]; delete: [id: string]; cancel: []; 'update:open': [open: boolean] }>()

const { phase } = useSupabaseAuth()
const canEdit = computed(() => phase.value === 'manager')

const selectedTopic = computed(() => props.topics.find(t => t.key === form.topic_key) || null)
const previewCaption = computed(() => { const c = form.caption || 'Your caption here...'; return c.length > 80 ? c.slice(0, 80) + '...' : c })
const formattedHashtags = computed(() => { if (!form.hashtags) return ''; return form.hashtags.split(/\s+/).filter(Boolean).map(t => t.startsWith('#') ? t : `#${t}`).join(' ') })

function formatPreviewDate(day: string): string { if (!day) return ''; const d = new Date(day + 'T00:00:00'), n = new Date(), diff = d.getTime() - n.getTime(), days = Math.ceil(diff / 86400000); if (days === 0) return 'Just now'; if (days === 1) return 'Tomorrow'; if (days === -1) return 'Yesterday'; if (days > 1 && days < 7) return `${days} days ago`; return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }

const form = reactive<{ id: string; day: string; scheduled_at: string | null; topic_key: string; format: PostFormat; status: PostStatus; title: string; caption: string; hashtags: string; image_base64: string | null; video_base64: string | null }>({ id: '', day: '', scheduled_at: null, topic_key: '', format: 'Carousel', status: 'planned', title: '', caption: '', hashtags: '', image_base64: null, video_base64: null })
const saving = ref(false)
const mediaPreview = ref<string | null>(null)
const mediaKind = ref<'image' | 'video' | null>(null)
const mediaBytes = ref(0)
const mediaSource = ref<'local' | 'gdrive'>('local')
const gdrivePickerOpen = ref(false)
const gdriveSelectionMode = ref<'single' | 'multiple' | 'folder'>('single')

function close() { emit('update:open', false) }
watch(() => props.open, (open) => { if (open) resetForm() })

function resetForm() { const post = props.post; const baseDay = post ? post.day : props.day; saving.value = false; form.id = post?.id ?? ''; form.day = post ? post.day : baseDay; form.scheduled_at = post?.scheduled_at ?? null; form.topic_key = post?.topic_key ?? ''; form.format = (post?.format ?? 'Carousel') as PostFormat; form.status = (post?.status ?? 'planned') as PostStatus; form.title = post?.title ?? ''; form.caption = post?.caption ?? ''; form.hashtags = post?.hashtags ?? ''; form.image_base64 = post?.image_base64 ?? null; form.video_base64 = post?.video_base64 ?? null; if (post?.video_base64) { mediaPreview.value = post.video_base64; mediaKind.value = 'video'; mediaBytes.value = post.video_bytes ?? 0 } else if (post?.image_base64) { mediaPreview.value = post.image_base64; mediaKind.value = 'image'; mediaBytes.value = post.image_bytes ?? 0 } else { mediaPreview.value = null; mediaKind.value = null; mediaBytes.value = 0 } mediaSource.value = 'local'; gdrivePickerOpen.value = false }

async function onMedia(event: Event) { const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return; const isVideo = file.type.startsWith('video/'); const isImage = file.type.startsWith('image/'); if (!isVideo && !isImage) { alert('Please select an image or video file.'); return } const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES; if (file.size > maxBytes) { alert(`${isVideo ? 'Video' : 'Image'} too large (${formatBytes(file.size)}). Limit: ${formatBytes(maxBytes)}.`); return } try { const payload = await fileToDataUrl(file, { kind: isVideo ? 'video' : 'image', maxBytes }); if (isVideo) { form.image_base64 = null; form.video_base64 = payload.base64 } else { form.video_base64 = null; form.image_base64 = payload.base64 } mediaPreview.value = payload.base64; mediaKind.value = payload.kind; mediaBytes.value = payload.bytes } catch (err) { alert(err instanceof Error ? err.message : 'Could not read the file.') } }

function clearMedia() { form.image_base64 = null; form.video_base64 = null; mediaPreview.value = null; mediaKind.value = null; mediaBytes.value = 0 }

async function downloadMedia() { if (!mediaPreview.value) return; const mime = mediaPreview.value.match(/data:(.*?);/)![1] ?? 'application/octet-stream'; const ext = mime.split('/')[1] || (mediaKind.value === 'video' ? 'mp4' : 'jpg'); downloadDataUrl(mediaPreview.value, slugify(`${props.post?.day || 'media'}_${props.post?.topic_key || 'post'}`) + '.' + ext) }

function openGoogleDrivePicker() { gdriveSelectionMode.value = form.format === 'Carousel' ? 'folder' : 'multiple'; gdrivePickerOpen.value = true }

function onGoogleDriveSelect(mediaFiles: Array<{ id: string; name: string; mimeType: string; size: number; dataUrl: string; kind: 'image' | 'video' }>) { if (mediaFiles.length === 0) return; const firstFile = mediaFiles[0]; if (!firstFile) return; const isVideo = firstFile.kind === 'video'; if (isVideo) { form.image_base64 = null; form.video_base64 = firstFile.dataUrl } else { form.video_base64 = null; form.image_base64 = firstFile.dataUrl } mediaPreview.value = firstFile.dataUrl; mediaKind.value = firstFile.kind; mediaBytes.value = firstFile.size; if (form.format === 'Carousel' && mediaFiles.length > 1) { console.warn(`Carousel: ${mediaFiles.length} files selected from Google Drive. Current schema supports only 1 media file per post. Using first file: ${firstFile.name}`); alert(`Carousel mode: ${mediaFiles.length} files selected, but only the first (${firstFile.name}) will be used. Multi-image carousel support requires schema changes.`) } gdrivePickerOpen.value = false; mediaSource.value = 'gdrive' }

async function handleSubmit() { if (!form.topic_key) { alert('Please select a topic — every post must be linked to one.'); return } const draft: any = { id: form.id || undefined, day: form.day, scheduled_at: form.scheduled_at || null, topic_key: form.topic_key, format: form.format, status: form.status, title: form.title, caption: form.caption, hashtags: form.hashtags }; if (form.image_base64) { draft.image_base64 = form.image_base64; draft.image_name = 'upload'; draft.image_bytes = mediaKind.value === 'image' ? mediaBytes.value : null } else if (props.post) draft.image_base64 = null; if (form.video_base64) { draft.video_base64 = form.video_base64; draft.video_name = 'upload'; draft.video_bytes = mediaKind.value === 'video' ? mediaBytes.value : null } else if (props.post) draft.video_base64 = null; saving.value = true; emit('save', draft) }

async function handleDelete() { if (!props.post?.id) return; if (window.confirm('Delete this post?')) { emit('delete', props.post.id); close() } }
</script>
