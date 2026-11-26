<template>
  <Transition name="modal">
    <div
      v-if="open"
      ref="modalRoot"
      class="fixed inset-0 z-50 outline-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gdp-title"
      tabindex="-1"
      @keydown="onKeydown"
    >
      <div class="absolute inset-0 bg-black/55 backdrop-blur-2xl" aria-hidden="true" @click="close()" />

      <div class="eg-sheet absolute inset-0 flex flex-col overflow-hidden sm:inset-4 lg:inset-8">
        <header class="eg-sheet-header flex-shrink-0">
          <div class="min-w-0">
            <h2 id="gdp-title" class="text-[15px] font-semibold tracking-tight text-white">Google Drive</h2>
            <p class="mt-0.5 truncate text-xs text-zinc-500">{{ subtitle }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <button v-if="canGoUp" type="button" class="eg-icon-btn" aria-label="Go to parent folder" @click="goUp">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 15l-6-6-6 6" /></svg>
            </button>
            <button type="button" class="eg-icon-btn" aria-label="Close picker" @click="close()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </header>

        <!-- Search -->
        <div class="flex-shrink-0 border-b border-white/10 px-4 py-3 sm:px-6">
          <div class="relative">
            <svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            <input
              ref="searchInput"
              v-model="searchQuery"
              type="search"
              class="eg-field pl-10 pr-9"
              placeholder="Search files and folders…"
              aria-label="Search files and folders in Google Drive"
              @input="onSearchInput"
              @keydown.enter.prevent="runSearch"
              @keydown.esc="onSearchEscape"
            />
            <button
              v-if="searchQuery"
              type="button"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-500 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
              aria-label="Clear search"
              @click="clearSearch"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <!-- Breadcrumbs (real navigation stack) -->
        <nav v-if="!executedSearch && folderStack.length > 1" class="flex-shrink-0 border-b border-white/10 px-4 py-2 sm:px-6" aria-label="Breadcrumb">
          <ol class="flex items-center gap-1 overflow-x-auto text-xs">
            <li v-for="(crumb, i) in folderStack" :key="crumb.id" class="flex items-center gap-1 whitespace-nowrap">
              <button
                v-if="i < folderStack.length - 1"
                type="button"
                class="rounded px-1 py-0.5 text-zinc-500 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                @click="goToCrumb(i)"
              >{{ crumb.name }}</button>
              <span v-if="i < folderStack.length - 1" class="text-zinc-700" aria-hidden="true">/</span>
              <span v-else class="font-medium text-zinc-300" aria-current="page">{{ crumb.name }}</span>
            </li>
          </ol>
        </nav>

        <!-- Search context bar -->
        <div v-if="executedSearch" class="flex flex-shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-2 sm:px-6">
          <p class="truncate text-xs text-zinc-400">Results for <span class="text-white">“{{ executedSearch }}”</span></p>
          <button
            type="button"
            class="shrink-0 text-xs text-emerald-400 transition hover:text-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
            @click="clearSearch"
          >Clear search</button>
        </div>

        <!-- Toolbar -->
        <div class="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2 sm:px-6" role="group" aria-label="Picker options">
          <p class="text-xs tabular-nums text-zinc-500" aria-live="polite">{{ countLabel }}</p>
          <div class="flex items-center gap-2">
            <label class="sr-only" for="gdp-mode">Selection mode</label>
            <select id="gdp-mode" v-model="selectionMode" class="eg-select text-xs" style="min-width: 158px" @change="onSelectionModeChange">
              <option value="single">Select one file</option>
              <option value="multiple">Select multiple files</option>
              <option value="folder">Select a folder</option>
            </select>
          </div>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-4 sm:p-6" :aria-busy="showSpinner ? 'true' : 'false'">
          <div v-if="showSignIn" class="flex h-full items-center justify-center">
            <div class="max-w-xs text-center">
              <svg class="mx-auto mb-3 text-zinc-600" width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
              <p class="text-sm font-medium text-zinc-200">Google Drive isn’t connected</p>
              <p class="mt-1 text-xs text-zinc-500">Sign in with Google to browse and pick your files.</p>
              <button type="button" class="eg-btn-apple-secondary mt-4 text-xs" @click="initialize">Check again</button>
            </div>
          </div>

          <div v-else-if="showSpinner" class="flex h-full items-center justify-center" role="status">
            <div class="flex flex-col items-center gap-3 text-zinc-500">
              <svg class="animate-spin text-emerald-400" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke-opacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round" /></svg>
              <span class="text-sm">{{ loadMessage }}</span>
            </div>
          </div>

          <div v-else-if="errorMessage" class="flex h-full items-center justify-center" role="alert">
            <div class="flex max-w-sm flex-col items-center gap-3 text-center">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" class="text-red-400" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 7.5v5" /><path d="M12 16.5h.01" /></svg>
              <p class="text-sm text-red-300">{{ errorMessage }}</p>
              <button type="button" class="eg-btn-apple-secondary text-xs" @click="retry">Try again</button>
            </div>
          </div>

          <div v-else-if="files.length === 0" class="flex h-full items-center justify-center">
            <div class="max-w-xs text-center">
              <svg class="mx-auto mb-3 text-zinc-600" width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M21 15V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v10" /><path d="M3 15v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V15" /></svg>
              <template v-if="executedSearch">
                <p class="text-sm text-zinc-300">No results for “{{ executedSearch }}”</p>
                <p class="mt-1 text-xs text-zinc-500">Check the spelling or try a broader term.</p>
                <button type="button" class="eg-btn-apple-secondary mt-4 text-xs" @click="clearSearch">Clear search</button>
              </template>
              <template v-else>
                <p class="text-sm text-zinc-300">This folder is empty</p>
                <p class="mt-1 text-xs text-zinc-500">Upload files to Drive or open a different folder.</p>
              </template>
            </div>
          </div>

          <template v-else>
            <div
              v-if="viewMode === 'grid'"
              class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              role="listbox"
              aria-label="Files"
              :aria-multiselectable="selectionMode === 'multiple'"
            >
              <div
                v-for="(file, i) in files"
                :key="file.id"
                class="group relative rounded-xl p-1 outline-none transition"
                :class="tileClasses(file)"
                role="option"
                :aria-selected="isSelected(file.id)"
                :tabindex="i === activeIndex ? 0 : -1"
                :title="tileTitle(file)"
                @click="onItemClick(file)"
                @dblclick="onItemDoubleClick(file)"
                @keydown="onOptionKeydown($event, i)"
                @keydown.enter.prevent="onItemEnter(file)"
                @keydown.space.prevent="onItemSpace(file)"
              >
                <div class="relative aspect-square overflow-hidden rounded-lg bg-zinc-800/80">
                  <template v-if="isFolderFile(file)">
                    <div class="flex h-full w-full items-center justify-center">
                      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-amber-400" aria-hidden="true"><path d="M21 15V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v10" /><path d="M3 15v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V15" /></svg>
                    </div>
                  </template>
                  <template v-else-if="file.mimeType.startsWith('image/')">
                    <img :src="file.thumbnailLink || file.iconLink" :alt="file.name" class="h-full w-full object-cover" loading="lazy" />
                  </template>
                  <template v-else-if="file.mimeType.startsWith('video/')">
                    <video :src="file.thumbnailLink" class="h-full w-full object-cover" muted playsinline preload="metadata" aria-hidden="true" />
                    <span class="absolute inset-0 flex items-center justify-center bg-black/30" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg></span>
                  </template>
                  <template v-else>
                    <div class="flex h-full w-full items-center justify-center"><img :src="file.iconLink" alt="" class="h-16 w-16 opacity-50" loading="lazy" /></div>
                  </template>
                  <div v-if="isSelected(file.id)" class="absolute inset-0 flex items-center justify-center bg-emerald-400/25" aria-hidden="true">
                    <span class="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400 shadow-md"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3.5"><polyline points="20 6 9 17 4 12" /></svg></span>
                  </div>
                </div>
                <p class="mt-1.5 truncate text-xs text-zinc-300 transition group-hover:text-white" :title="file.name">{{ file.name }}</p>
                <p class="truncate text-[10px]" :class="isFolderFile(file) ? 'text-amber-400/75' : 'text-zinc-500'">{{ metaLabel(file) }}</p>
              </div>
            </div>

            <div
              v-else
              class="divide-y divide-white/5"
              role="listbox"
              aria-label="Files"
              :aria-multiselectable="selectionMode === 'multiple'"
            >
              <div
                v-for="(file, i) in files"
                :key="file.id"
                class="flex items-center gap-3 rounded-lg px-2 py-2 outline-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                :class="rowClasses(file)"
                role="option"
                :aria-selected="isSelected(file.id)"
                :tabindex="i === activeIndex ? 0 : -1"
                :title="tileTitle(file)"
                @click="onItemClick(file)"
                @dblclick="onItemDoubleClick(file)"
                @keydown="onOptionKeydown($event, i)"
                @keydown.enter.prevent="onItemEnter(file)"
                @keydown.space.prevent="onItemSpace(file)"
              >
                <div class="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-800/80">
                  <template v-if="isFolderFile(file)">
                    <div class="flex h-full w-full items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-amber-400" aria-hidden="true"><path d="M21 15V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v10" /><path d="M3 15v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V15" /></svg>
                    </div>
                  </template>
                  <template v-else-if="file.mimeType.startsWith('image/')">
                    <img :src="file.thumbnailLink || file.iconLink" :alt="file.name" class="h-full w-full object-cover" loading="lazy" />
                  </template>
                  <template v-else-if="file.mimeType.startsWith('video/')">
                    <video :src="file.thumbnailLink" class="h-full w-full object-cover" muted playsinline preload="metadata" aria-hidden="true" />
                    <span class="absolute inset-0 flex items-center justify-center bg-black/30" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg></span>
                  </template>
                  <template v-else>
                    <div class="flex h-full w-full items-center justify-center"><img :src="file.iconLink" alt="" class="h-7 w-7 opacity-50" loading="lazy" /></div>
                  </template>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm text-white" :title="file.name">{{ file.name }}</p>
                  <p class="mt-0.5 truncate text-[11px] text-zinc-500">{{ metaLabel(file) }}<span class="mx-1" aria-hidden="true">·</span>{{ formatDate(file.modifiedTime) }}</p>
                </div>
                <span
                  v-if="selectionMode !== 'folder'"
                  class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition"
                  :class="isSelected(file.id) ? 'border-emerald-400 bg-emerald-400' : 'border-white/25'"
                  aria-hidden="true"
                >
                  <svg v-if="isSelected(file.id)" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3.5"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
              </div>
            </div>

            <div v-if="nextPageToken" class="mt-5 flex justify-center">
              <button type="button" class="eg-btn-apple-secondary text-xs" :disabled="loadingMore" @click="loadMore">
                <svg v-if="loadingMore" class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke-opacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round" /></svg>
                {{ loadingMore ? 'Loading…' : `Load more (${files.length} loaded)` }}
              </button>
            </div>
          </template>
        </div>

        <footer class="eg-sheet-footer flex-shrink-0">
          <div class="flex w-full items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="eg-btn-apple-secondary text-xs"
                :aria-label="viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'"
                @click="toggleViewMode"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0" aria-hidden="true">
                  <template v-if="viewMode === 'grid'"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></template>
                  <template v-else><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></template>
                </svg>
                {{ viewMode === 'grid' ? 'List' : 'Grid' }}
              </button>
              <button
                v-if="selectionMode === 'multiple'"
                type="button"
                class="eg-btn-apple-secondary text-xs"
                :disabled="selectableCount === 0"
                @click="toggleSelectAll"
              >{{ selectAll ? 'Deselect all' : `Select all (${selectableCount})` }}</button>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" class="eg-btn-apple-secondary" @click="close()">Cancel</button>
              <button type="button" class="eg-btn-apple-primary" :disabled="primaryDisabled" :title="primaryTitle" @click="onPrimaryAction">
                <span v-if="showSpinner" class="flex items-center gap-2" aria-hidden="true">
                  <svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10" stroke-opacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round" /></svg>
                  Working…
                </span>
                <span v-else>{{ primaryLabel }}</span>
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { DriveFile } from '~/composables/useGoogleDrive'
import { useGoogleDrive } from '~/composables/useGoogleDrive'
import { useToast } from '~/composables/useToast'
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

interface Props { open: boolean; selectionMode?: 'single' | 'multiple' | 'folder' }
interface Emits {
  select: [files: Array<{ id: string; name: string; mimeType: string; size: number; dataUrl: string; kind: 'image' | 'video' }>]
  cancel: []
  'update:open': [open: boolean]
  'update:selectionMode': [mode: 'single' | 'multiple' | 'folder']
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { loading, hasToken, listFiles, fetchFolderMedia, downloadFiles, searchFiles, isDownloadableMedia } = useGoogleDrive()
const toast = useToast()

const FOLDER_MIME = 'application/vnd.google-apps.folder'
const VIEW_STORAGE_KEY = 'eg:gdrive-picker:view'

const files = ref<DriveFile[]>([])
const folderStack = ref<Array<{ id: string; name: string }>>([{ id: 'root', name: 'My Drive' }])
const currentFolderId = ref('root')
const currentFolderName = ref('My Drive')
const searchQuery = ref('')
const executedSearch = ref('')
const viewMode = ref<'grid' | 'list'>('grid')
const selectedFiles = ref<Set<string>>(new Set())
const selectionMode = ref(props.selectionMode || 'single')
const loadMessage = ref('Loading…')
const busy = ref(false)
const loadingMore = ref(false)
const errorMessage = ref<string | null>(null)
const showSignIn = ref(false)
const nextPageToken = ref<string | null>(null)
const activeIndex = ref(0)
const modalRoot = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)

let requestSeq = 0
let retryAction: (() => void) | null = null
let searchTimer: ReturnType<typeof setTimeout> | null = null
let lastFocused: HTMLElement | null = null
let savedBodyOverflow: string | null = null
let activeAbort: AbortController | null = null

function abortActiveDownload() {
  activeAbort?.abort()
  activeAbort = null
}

if (import.meta.client) {
  const stored = localStorage.getItem(VIEW_STORAGE_KEY)
  if (stored === 'grid' || stored === 'list') viewMode.value = stored
}

const showSpinner = computed(() => busy.value || loading.value)
const canGoUp = computed(() => !executedSearch.value && folderStack.value.length > 1)
const subtitle = computed(() => executedSearch.value ? 'Search results' : currentFolderName.value)
const selectableFiles = computed(() => files.value.filter(f => isDownloadableMedia(f.mimeType)))
const selectableCount = computed(() => selectableFiles.value.length)
const selectAll = computed(() => selectableCount.value > 0 && selectableFiles.value.every(f => selectedFiles.value.has(f.id)))

const countLabel = computed(() => {
  if (showSpinner.value) return loadMessage.value
  const n = files.value.length
  const base = `${n}${nextPageToken.value ? '+' : ''} item${n === 1 ? '' : 's'}`
  const selected = selectedFiles.value.size
  return selected > 0 ? `${base} · ${selected} selected` : base
})

const primaryLabel = computed(() => {
  if (selectionMode.value === 'folder') return 'Select folder'
  const count = selectedFiles.value.size
  if (selectionMode.value === 'multiple') return count === 0 ? 'Add files' : `Add ${count} file${count === 1 ? '' : 's'}`
  return 'Add file'
})

const primaryDisabled = computed(() => {
  if (showSpinner.value) return true
  if (selectionMode.value === 'folder') return currentFolderId.value === 'root' || !!executedSearch.value
  return selectedFiles.value.size === 0
})

const primaryTitle = computed(() => {
  if (selectionMode.value !== 'folder') return ''
  if (executedSearch.value) return 'Clear the search to select this folder'
  if (currentFolderId.value === 'root') return 'Open a folder inside My Drive first'
  return ''
})

// ——— helpers ———

function isFolderFile(file: DriveFile): boolean { return file.mimeType === FOLDER_MIME }
function isSelected(fileId: string): boolean { return selectedFiles.value.has(fileId) }

type FileAction = 'open' | 'select' | 'none'
/** What a click on this item does in the current selection mode. */
function fileAction(file: DriveFile): FileAction {
  if (isFolderFile(file)) return 'open'
  if (selectionMode.value === 'folder') return 'none'
  if (!isDownloadableMedia(file.mimeType)) return 'none'
  return 'select'
}

const TYPE_LABELS: Record<string, string> = {
  'application/vnd.google-apps.document': 'Google Doc',
  'application/vnd.google-apps.spreadsheet': 'Google Sheet',
  'application/vnd.google-apps.presentation': 'Google Slides',
  'application/vnd.google-apps.drawing': 'Google Drawing',
  'application/pdf': 'PDF',
  'text/plain': 'Text file',
  'text/html': 'Web page',
  'application/zip': 'ZIP',
}

const MEDIA_EXT_LABELS: Record<string, string> = {
  jpeg: 'JPG', jpg: 'JPG', png: 'PNG', gif: 'GIF', webp: 'WEBP', heic: 'HEIC', heif: 'HEIF', svg: 'SVG',
  mp4: 'MP4', webm: 'WEBM', quicktime: 'MOV', mpeg: 'MPG', 'x-m4v': 'M4V', '3gpp': '3GP',
  mp3: 'MP3', wav: 'WAV', ogg: 'OGG', 'x-m4a': 'M4A',
}

function shortType(mimeType: string): string {
  const known = TYPE_LABELS[mimeType]
  if (known) return known
  const subtype = mimeType.includes('/') ? mimeType.split('/')[1]! : mimeType
  const ext = MEDIA_EXT_LABELS[subtype] ?? subtype.split('.')[0]!.toUpperCase()
  if (mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType.startsWith('audio/')) return ext
  return 'File'
}

function sizeLabel(file: DriveFile): string {
  const bytes = Number(file.size || 0)
  if (!bytes) return ''
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

function metaLabel(file: DriveFile): string {
  if (isFolderFile(file)) return 'Folder'
  const type = shortType(file.mimeType)
  const size = sizeLabel(file)
  return size ? `${type} · ${size}` : type
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function tileClasses(file: DriveFile): string[] {
  const classes = ['focus-visible:outline', 'focus-visible:outline-2', 'focus-visible:outline-offset-2', 'focus-visible:outline-emerald-400']
  const selected = isSelected(file.id)
  if (selected) classes.push('ring-2', 'ring-emerald-400')
  const actionable = fileAction(file) !== 'none'
  classes.push(actionable ? 'cursor-pointer' : 'cursor-default')
  if (actionable && !selected) classes.push('ring-1', 'ring-transparent', 'hover:ring-white/15')
  return classes
}

function rowClasses(file: DriveFile): string[] {
  if (isSelected(file.id)) return ['bg-emerald-400/10', 'cursor-pointer']
  return fileAction(file) !== 'none' ? ['hover:bg-white/5', 'cursor-pointer'] : ['cursor-default']
}

function tileTitle(file: DriveFile): string {
  const action = fileAction(file)
  if (action === 'open') return `Open ${file.name}`
  if (action === 'none') return `${file.name} — can’t be added to a post`
  return file.name
}

// ——— loading / errors ———

function cancelSearchTimer() {
  if (searchTimer) { clearTimeout(searchTimer); searchTimer = null }
}

function fail(err: unknown, retry: () => void) {
  const message = err instanceof Error ? err.message : 'Something went wrong while loading files.'
  retryAction = retry
  if (/token/i.test(message)) {
    errorMessage.value = null
    showSignIn.value = true
  } else {
    errorMessage.value = message
  }
}

function retry() {
  const action = retryAction
  retryAction = null
  action?.()
}

function initialize() {
  cancelSearchTimer()
  abortActiveDownload()
  requestSeq++
  busy.value = false
  loadingMore.value = false
  files.value = []
  nextPageToken.value = null
  folderStack.value = [{ id: 'root', name: 'My Drive' }]
  currentFolderId.value = 'root'
  currentFolderName.value = 'My Drive'
  searchQuery.value = ''
  executedSearch.value = ''
  selectedFiles.value = new Set()
  errorMessage.value = null
  showSignIn.value = false
  retryAction = null
  loadMessage.value = 'Loading…'
  // Focus must enter the dialog in every state (incl. signed-out), otherwise
  // Escape and the focus trap never see keyboard events.
  nextTick(() => searchInput.value?.focus())
  if (!hasToken.value) { showSignIn.value = true; return }
  void loadFolder('root', 'My Drive')
}

async function loadFolder(folderId: string, folderName: string) {
  const seq = ++requestSeq
  busy.value = true
  errorMessage.value = null
  showSignIn.value = false
  retryAction = null
  executedSearch.value = ''
  loadMessage.value = 'Loading…'
  try {
    const response = await listFiles(folderId)
    if (seq !== requestSeq) return
    files.value = response.files
    nextPageToken.value = response.nextPageToken ?? null
    currentFolderId.value = folderId
    currentFolderName.value = folderName
  } catch (err) {
    if (seq !== requestSeq) return
    fail(err, () => { void loadFolder(folderId, folderName) })
  } finally {
    if (seq === requestSeq) busy.value = false
  }
}

async function loadMore() {
  const token = nextPageToken.value
  if (!token || loadingMore.value) return
  const seq = requestSeq
  loadingMore.value = true
  try {
    const response = await listFiles(currentFolderId.value, token)
    if (seq !== requestSeq) return
    files.value = [...files.value, ...response.files]
    nextPageToken.value = response.nextPageToken ?? null
  } catch (err) {
    if (seq !== requestSeq) return
    fail(err, () => { void loadMore() })
  } finally {
    loadingMore.value = false
  }
}

// ——— navigation ———

function openFolder(file: DriveFile) {
  if (!isFolderFile(file)) return
  if (busy.value) return // a listing is already on its way; ignore double-clicks
  if (folderStack.value[folderStack.value.length - 1]?.id === file.id) return
  cancelSearchTimer()
  searchQuery.value = ''
  folderStack.value = [...folderStack.value, { id: file.id, name: file.name }]
  void loadFolder(file.id, file.name)
}

function goUp() {
  const parent = folderStack.value[folderStack.value.length - 2]
  if (!parent) return
  folderStack.value = folderStack.value.slice(0, -1)
  cancelSearchTimer()
  searchQuery.value = ''
  void loadFolder(parent.id, parent.name)
}

function goToCrumb(index: number) {
  const target = folderStack.value[index]
  if (!target || index >= folderStack.value.length - 1) return
  folderStack.value = folderStack.value.slice(0, index + 1)
  cancelSearchTimer()
  searchQuery.value = ''
  void loadFolder(target.id, target.name)
}

// ——— search ———

function onSearchInput() {
  cancelSearchTimer()
  searchTimer = setTimeout(() => {
    searchTimer = null
    void runSearch()
  }, 300)
}

function onSearchEscape(event: KeyboardEvent) {
  if (!searchQuery.value) return // empty search: let Escape bubble and close the picker
  event.preventDefault()
  event.stopPropagation()
  clearSearch()
}

async function runSearch() {
  cancelSearchTimer()
  const query = searchQuery.value.trim()
  if (!query) {
    await loadFolder(currentFolderId.value, currentFolderName.value)
    return
  }
  const seq = ++requestSeq
  busy.value = true
  errorMessage.value = null
  showSignIn.value = false
  retryAction = null
  loadMessage.value = 'Searching…'
  try {
    const results = await searchFiles(query)
    if (seq !== requestSeq) return
    files.value = results
    nextPageToken.value = null
    executedSearch.value = query
  } catch (err) {
    if (seq !== requestSeq) return
    fail(err, () => { void runSearch() })
  } finally {
    if (seq === requestSeq) busy.value = false
  }
}

function clearSearch() {
  cancelSearchTimer()
  searchQuery.value = ''
  executedSearch.value = ''
  void runSearch()
}

// ——— selection ———

function markActive(file: DriveFile) {
  const index = files.value.indexOf(file)
  if (index >= 0) activeIndex.value = index
}

function toggleFileSelection(file: DriveFile) {
  if (fileAction(file) !== 'select') return
  if (selectionMode.value === 'single') {
    const wasSelected = selectedFiles.value.has(file.id)
    selectedFiles.value.clear()
    if (!wasSelected) selectedFiles.value.add(file.id)
  } else if (selectedFiles.value.has(file.id)) {
    selectedFiles.value.delete(file.id)
  } else {
    selectedFiles.value.add(file.id)
  }
}

function onItemClick(file: DriveFile) {
  markActive(file)
  const action = fileAction(file)
  if (action === 'open') openFolder(file)
  else if (action === 'select') toggleFileSelection(file)
}

function onItemDoubleClick(file: DriveFile) {
  if (selectionMode.value !== 'single' || fileAction(file) !== 'select') return
  markActive(file)
  selectedFiles.value.clear()
  selectedFiles.value.add(file.id)
  void confirmSelection()
}

function onItemEnter(file: DriveFile) {
  markActive(file)
  const action = fileAction(file)
  if (action === 'open') { openFolder(file); return }
  if (action !== 'select') return
  if (selectionMode.value === 'single') {
    selectedFiles.value.clear()
    selectedFiles.value.add(file.id)
    void confirmSelection()
  } else if (selectionMode.value === 'multiple') {
    toggleFileSelection(file)
  }
}

function onItemSpace(file: DriveFile) {
  markActive(file)
  const action = fileAction(file)
  if (action === 'open') openFolder(file)
  else if (action === 'select') toggleFileSelection(file)
}

/** Roving focus: Arrow/Home/End move between options instead of tabbing through all of them. */
function onOptionKeydown(event: KeyboardEvent, index: number) {
  let target = -1
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') target = Math.min(index + 1, files.value.length - 1)
  else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') target = Math.max(index - 1, 0)
  else if (event.key === 'Home') target = 0
  else if (event.key === 'End') target = files.value.length - 1
  else return
  event.preventDefault()
  const option = event.currentTarget as HTMLElement | null
  const parent = option?.parentElement ?? null
  if (target === index) {
    activeIndex.value = index
    option?.focus()
    return
  }
  activeIndex.value = target
  nextTick(() => {
    const el = parent?.children[target] as HTMLElement | undefined
    el?.focus()
  })
}

function toggleSelectAll() {
  if (selectAll.value) {
    for (const f of selectableFiles.value) selectedFiles.value.delete(f.id)
  } else {
    for (const f of selectableFiles.value) selectedFiles.value.add(f.id)
  }
}

function onSelectionModeChange() {
  const hadSelection = selectedFiles.value.size > 0
  selectedFiles.value.clear()
  emit('update:selectionMode', selectionMode.value)
  if (hadSelection) toast.info('Selection cleared — selection mode changed.')
}

// ——— confirm ———

async function confirmSelection() {
  if (selectedFiles.value.size === 0 || showSpinner.value) return
  const seq = requestSeq
  const controller = new AbortController()
  activeAbort = controller
  const count = selectedFiles.value.size
  loadMessage.value = count > 1 ? `Downloading ${count} files…` : 'Downloading file…'
  errorMessage.value = null
  retryAction = null
  try {
    const mediaFiles = await downloadFiles(Array.from(selectedFiles.value), { signal: controller.signal })
    if (activeAbort === controller) activeAbort = null
    // Discard the result if the user closed/cancelled or navigated meanwhile.
    if (seq !== requestSeq || !props.open) return
    if (mediaFiles.length === 0) {
      toast.error('No downloadable media in the selection.')
      return
    }
    emit('select', mediaFiles)
    close({ silent: true })
  } catch (err) {
    if (activeAbort === controller) activeAbort = null
    if (seq !== requestSeq || !props.open) return
    fail(err, () => { void confirmSelection() })
  }
}

async function selectCurrentFolder() {
  if (currentFolderId.value === 'root' || showSpinner.value || executedSearch.value) return
  const seq = requestSeq
  const controller = new AbortController()
  activeAbort = controller
  loadMessage.value = 'Collecting media from this folder…'
  errorMessage.value = null
  retryAction = null
  try {
    const mediaFiles = await fetchFolderMedia(currentFolderId.value, (current, total) => {
      if (seq !== requestSeq) return // user cancelled/closed — stop updating UI
      loadMessage.value = total ? `Downloading ${current} / ${total} files…` : `Downloading ${current} files…`
    }, { signal: controller.signal })
    if (activeAbort === controller) activeAbort = null
    if (seq !== requestSeq || !props.open) return
    if (mediaFiles.length === 0) {
      toast.error('No images or videos found in this folder.')
      return
    }
    emit('select', mediaFiles)
    close({ silent: true })
  } catch (err) {
    if (activeAbort === controller) activeAbort = null
    if (seq !== requestSeq || !props.open) return
    fail(err, () => { void selectCurrentFolder() })
  }
}

function onPrimaryAction() {
  if (selectionMode.value === 'folder') void selectCurrentFolder()
  else void confirmSelection()
}

// ——— modal behavior ———

function close(options?: { silent?: boolean }) {
  requestSeq++ // invalidate any in-flight browse/download follow-up
  cancelSearchTimer()
  abortActiveDownload()
  if (import.meta.client && lastFocused && lastFocused !== document.body && document.contains(lastFocused)) {
    lastFocused.focus()
  }
  emit('update:open', false)
  if (!options?.silent) emit('cancel')
}

function trapFocus(event: KeyboardEvent) {
  const root = modalRoot.value
  if (!root) return
  const focusables = Array.from(
    root.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'),
  )
  if (focusables.length === 0) return
  const first = focusables[0]!
  const last = focusables[focusables.length - 1]!
  const active = document.activeElement
  const outside = !active || !root.contains(active)
  if (event.shiftKey) {
    if (outside || active === first) { event.preventDefault(); last.focus() }
  } else if (outside || active === last) {
    event.preventDefault()
    first.focus()
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); close(); return }
  if (event.key === 'Tab') trapFocus(event)
}

function toggleViewMode() {
  viewMode.value = viewMode.value === 'grid' ? 'list' : 'grid'
  if (import.meta.client) localStorage.setItem(VIEW_STORAGE_KEY, viewMode.value)
}

// ——— lifecycle ———

function captureFocusTarget() {
  if (!import.meta.client) return
  const active = document.activeElement
  lastFocused = active instanceof HTMLElement && !modalRoot.value?.contains(active) ? active : null
}

function lockBodyScroll() {
  if (!import.meta.client || savedBodyOverflow !== null) return
  savedBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
}

function unlockBodyScroll() {
  if (!import.meta.client || savedBodyOverflow === null) return
  document.body.style.overflow = savedBodyOverflow
  savedBodyOverflow = null
}

watch(() => props.open, (open) => {
  if (open) {
    captureFocusTarget()
    lockBodyScroll()
    initialize()
  } else {
    unlockBodyScroll()
  }
})

watch(hasToken, (connected) => {
  if (connected && props.open && showSignIn.value) initialize()
})

watch(() => props.selectionMode, (mode) => {
  if (mode && mode !== selectionMode.value) {
    selectionMode.value = mode
    selectedFiles.value.clear()
  }
})

watch(files, () => { activeIndex.value = 0 })

onMounted(() => {
  if (props.open) {
    captureFocusTarget()
    lockBodyScroll()
    initialize()
  }
})

onBeforeUnmount(() => {
  cancelSearchTimer()
  unlockBodyScroll()
})
</script>
