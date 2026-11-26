<template>
  <Transition name="modal">
    <div v-if="open" class="fixed inset-0 z-50" @click.self="close">
      <div class="absolute inset-0 bg-black/55 backdrop-blur-2xl" aria-hidden="true" />
      
      <div class="eg-sheet absolute inset-0 flex flex-col overflow-hidden sm:inset-4 lg:inset-8 max-h-[90vh]">
        <header class="eg-sheet-header flex-shrink-0">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-[15px] font-semibold tracking-tight text-white">Google Drive</h2>
              <p class="mt-0.5 text-xs text-zinc-500">{{ currentFolderName === 'root' ? 'My Drive' : currentFolderName }}</p>
            </div>
            <div class="flex items-center gap-2">
              <button v-if="currentFolderId !== 'root'" type="button" class="eg-icon-btn" aria-label="Go up" @click="goUp">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button type="button" class="eg-icon-btn" aria-label="Close" @click="close"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
            </div>
          </div>
          <div class="mt-3 relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="search" v-model="searchQuery" @input.debounce.300="handleSearch" @keydown.enter="handleSearch" placeholder="Search files and folders..." class="eg-field pl-10" />
            <button v-if="searchQuery" type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white" @click="clearSearch"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
          </div>
        </header>

        <div class="flex-1 overflow-hidden">
          <nav v-if="breadcrumbs.length > 1" class="px-4 py-2 border-b border-white/08" aria-label="Breadcrumb">
            <ol class="flex items-center gap-1 text-xs overflow-x-auto pb-1">
              <li v-for="(crumb, i) in breadcrumbs" :key="crumb.id" class="flex items-center gap-1 whitespace-nowrap">
                <button v-if="i < breadcrumbs.length - 1" type="button" class="text-zinc-500 hover:text-white transition" @click="navigateToFolder(crumb.id, crumb.name)">{{ crumb.name }}</button>
                <span v-if="i < breadcrumbs.length - 1" class="text-zinc-700">/</span>
                <span v-else class="text-zinc-300 font-medium">{{ crumb.name }}</span>
              </li>
            </ol>
          </nav>

          <div class="px-4 py-2 border-b border-white/08 flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-2">
              <span class="text-xs text-zinc-500">{{ files.length }} item(s)</span>
              <template v-if="selectionMode === 'multiple' || selectionMode === 'folder'"><span class="text-xs text-emerald-400">({{ selectedFiles.size }} selected)</span></template>
            </div>
            <div class="flex items-center gap-2">
              <select v-model="selectionMode" class="eg-select text-xs" style="min-width: 140px">
                <option value="single">Single file</option>
                <option value="multiple">Multiple files</option>
                <option value="folder">Folder (carousel)</option>
              </select>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-4">
            <div v-if="isLoading" class="flex items-center justify-center h-full"><div class="flex flex-col items-center gap-3 text-zinc-500"><svg class="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-opacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1" stroke-linecap="round" /></svg><span class="text-sm">{{ loadMessage }}</span></div></div>
            <div v-else-if="error" class="flex items-center justify-center h-full text-red-400 text-center px-4"><div class="flex flex-col items-center gap-2"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>{{ error }}</p><button type="button" class="eg-btn-apple-secondary text-xs" @click="loadFolder(currentFolderId)">Retry</button></div></div>
            <div v-else-if="files.length === 0" class="flex items-center justify-center h-full text-zinc-500"><div class="text-center"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" class="mx-auto mb-2"><path d="M21 15V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v10"/><path d="M3 15v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V15"/></svg><p class="text-sm">No files or folders found</p><p class="text-xs mt-1">Try a different folder or search term</p></div></div>
            <template v-else>
              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3" v-if="viewMode === 'grid'">
                <div v-for="file in files" :key="file.id" class="group relative" :class="{ 'ring-2 ring-emerald-400': isSelected(file.id), 'opacity-50': file.mimeType === 'application/vnd.google-apps.folder' && selectionMode !== 'folder' }" @click="toggleSelection(file)" @dblclick="handleDoubleClick(file)">
                  <div class="aspect-square rounded-lg bg-zinc-800 overflow-hidden relative">
                    <template v-if="file.mimeType === 'application/vnd.google-apps.folder'"><div class="flex h-full w-full items-center justify-center"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-amber-400"><path d="M21 15V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v10"/><path d="M3 15v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V15"/></svg></div><div class="absolute bottom-1 left-1 right-1 flex items-center justify-center"><span class="text-[10px] bg-black/70 text-amber-300 px-1.5 py-0.5 rounded">Folder</span></div></template>
                    <template v-else-if="file.mimeType.startsWith('image/')"><img :src="file.thumbnailLink || file.iconLink" :alt="file.name" class="h-full w-full object-cover" loading="lazy" /></template>
                    <template v-else-if="file.mimeType.startsWith('video/')"><video :src="file.thumbnailLink" class="h-full w-full object-cover" muted playsinline preload="metadata" /><div class="absolute inset-0 flex items-center justify-center bg-black/30"><svg width="32" height="32" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg></div></template>
                    <template v-else><div class="flex h-full w-full items-center justify-center"><img :src="file.iconLink" alt="" class="h-16 w-16 opacity-50" /></div></template>
                    <div v-if="isSelected(file.id)" class="absolute inset-0 bg-emerald-400/30 flex items-center justify-center"><div class="h-6 w-6 rounded-full bg-emerald-400 flex items-center justify-center"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div></div>
                    <div v-if="file.mimeType === 'application/vnd.google-apps.folder'" class="absolute top-1 right-1"><span class="bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded-full">Folder</span></div>
                  </div>
                  <p class="mt-1.5 text-xs text-zinc-300 truncate group-hover:text-white transition" :title="file.name">{{ file.name }}</p>
                  <p class="text-[10px] text-zinc-500 truncate">{{ file.mimeType === 'application/vnd.google-apps.folder' ? 'Folder' : formatFileInfo(file) }}</p>
                </div>
              </div>
              <div v-else class="divide-y divide-white/05">
                <div v-for="file in files" :key="file.id" class="flex items-center gap-3 px-2 py-2 hover:bg-white/03 transition rounded-lg" :class="{ 'bg-emerald-400/10': isSelected(file.id) }" @click="toggleSelection(file)" @dblclick="handleDoubleClick(file)">
                  <div class="flex-shrink-0 w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center relative overflow-hidden">
                    <template v-if="file.mimeType === 'application/vnd.google-apps.folder'"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-amber-400"><path d="M21 15V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v10"/><path d="M3 15v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V15"/></svg></template>
                    <template v-else-if="file.mimeType.startsWith('image/')"><img :src="file.thumbnailLink || file.iconLink" :alt="file.name" class="h-full w-full object-cover" /></template>
                    <template v-else-if="file.mimeType.startsWith('video/')"><video :src="file.thumbnailLink" class="h-full w-full object-cover" muted playsinline /><svg width="16" height="16" viewBox="0 0 24 24" fill="white" class="absolute"><polygon points="5,3 19,12 5,21"/></svg></template>
                    <template v-else><img :src="file.iconLink" alt="" class="h-8 w-8 opacity-50" /></template>
                  </div>
                  <div class="flex-1 min-w-0"><p class="text-sm text-white truncate" :title="file.name">{{ file.name }}</p><p class="text-[11px] text-zinc-500">{{ file.mimeType === 'application/vnd.google-apps.folder' ? 'Folder' : formatFileInfo(file) }}<span class="mx-1">·</span>{{ formatDate(file.modifiedTime) }}</p></div>
                  <div v-if="isSelected(file.id)" class="flex-shrink-0 h-6 w-6 rounded-full bg-emerald-400 flex items-center justify-center"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <footer class="eg-sheet-footer flex-shrink-0">
          <div class="w-full flex items-center justify-between">
            <div class="flex items-center gap-3"><button type="button" class="eg-btn-apple-secondary text-xs" @click="toggleViewMode"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-1"><template v-if="viewMode === 'grid'"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></template><template v-else><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></template></svg>{{ viewMode === 'grid' ? 'List' : 'Grid' }}</button></div>
            <div class="flex items-center gap-2">
              <button type="button" class="eg-btn-apple-secondary" @click="close">Cancel</button>
              <button v-if="selectionMode === 'folder' && currentFolderId !== 'root'" type="button" class="eg-btn-apple-primary" :disabled="isLoading" @click="selectCurrentFolder"><span v-if="isLoading" class="flex items-center gap-2"><span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />Loading...</span><span v-else>Select Folder ({{ mediaFilesCount }} media files)</span></button>
              <button v-else-if="selectionMode === 'multiple'" type="button" class="eg-btn-apple-primary" :disabled="isLoading || selectedFiles.size === 0" @click="confirmSelection"><span v-if="isLoading" class="flex items-center gap-2"><span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />Loading...</span><span v-else>Add {{ selectedFiles.size }} file(s)</span></button>
              <button v-else type="button" class="eg-btn-apple-primary" :disabled="isLoading || selectedFiles.size === 0" @click="confirmSelection"><span v-if="isLoading" class="flex items-center gap-2"><span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />Loading...</span><span v-else>Add File</span></button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { DriveFilePublic } from '~/composables/useGoogleDrive'
import { useGoogleDrive } from '~/composables/useGoogleDrive'
import { ref, computed, watch, onMounted } from 'vue'

interface Props { open: boolean; selectionMode?: 'single' | 'multiple' | 'folder' }
interface Emits { select: [files: Array<{ id: string; name: string; mimeType: string; size: number; dataUrl: string; kind: 'image' | 'video' }>]; cancel: []; 'update:open': [open: boolean] }

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { loading, error, listFiles, fetchFolderMedia, downloadFiles, searchFiles, getFile } = useGoogleDrive()

const files = ref<DriveFilePublic[]>([])
const currentFolderId = ref('root')
const currentFolderName = ref('My Drive')
const breadcrumbs = ref<Array<{ id: string; name: string }>>([{ id: 'root', name: 'My Drive' }])
const searchQuery = ref('')
const isSearching = ref(false)
const viewMode = ref<'grid' | 'list'>('grid')
const selectedFiles = ref<Set<string>>(new Set())
const selectionMode = ref(props.selectionMode || 'single')
const loadMessage = ref('Loading...')

const isLoading = computed(() => loading.value)
const mediaFilesCount = computed(() => files.value.filter((f: DriveFilePublic) => f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/')).length)

function close() { emit('update:open', false); emit('cancel') }
function formatFileInfo(file: DriveFilePublic): string { const size = file.size ? parseInt(file.size, 10) : 0; if (size === 0) return file.mimeType; const kb = size / 1024; if (kb < 1024) return `${kb.toFixed(1)} KB`; return `${(kb / 1024).toFixed(1)} MB` }
function formatDate(iso: string): string { const date = new Date(iso); const now = new Date(); const diff = now.getTime() - date.getTime(); const days = Math.floor(diff / (1000 * 60 * 60 * 24)); if (days === 0) return 'Today'; if (days === 1) return 'Yesterday'; if (days < 7) return `${days}d ago`; return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
function isSelected(fileId: string): boolean { return selectedFiles.value.has(fileId) }

async function loadFolder(folderId: string, folderName?: string) {
  if (isSearching.value) return
  currentFolderId.value = folderId
  currentFolderName.value = folderName || 'Loading...'
  selectedFiles.value.clear()
  loadMessage.value = 'Loading...'
  try {
    const response = await listFiles(folderId)
    files.value = response.files
    if (folderName) currentFolderName.value = folderName
    else if (folderId === 'root') currentFolderName.value = 'My Drive'
    else { const folderFile = response.files.find(f => f.id === folderId); currentFolderName.value = folderFile?.name || 'Folder' }
    if (folderId === 'root') breadcrumbs.value = [{ id: 'root', name: 'My Drive' }]
    else { try { const folderMeta = await getFile(folderId); updateBreadcrumbs(folderMeta) } catch { if (!breadcrumbs.value.some(b => b.id === folderId)) breadcrumbs.value.push({ id: folderId, name: currentFolderName.value }) } }
  } catch (err) { console.error('Failed to load folder:', err) }
}

function updateBreadcrumbs(folder: DriveFilePublic) { const path: Array<{ id: string; name: string }> = [{ id: 'root', name: 'My Drive' }]; if (folder.parents) path.push({ id: folder.id, name: folder.name }); breadcrumbs.value = path }

async function handleSearch() { const q = searchQuery.value.trim(); if (!q) { isSearching.value = false; await loadFolder(currentFolderId.value); return } isSearching.value = true; loadMessage.value = 'Searching...'; selectedFiles.value.clear(); try { const results = await searchFiles(q); files.value = results; currentFolderName.value = `Search: "${q}"`; breadcrumbs.value = [{ id: 'root', name: 'My Drive' }, { id: 'search', name: `Search: "${q}"` }] } catch (err) { console.error('Search failed:', err) } finally { isSearching.value = false } }
function clearSearch() { searchQuery.value = ''; handleSearch() }
function navigateToFolder(folderId: string, folderName: string) { searchQuery.value = ''; loadFolder(folderId, folderName) }
function goUp() { if (currentFolderId.value === 'root') return; searchQuery.value = ''; const parent = breadcrumbs.value[breadcrumbs.value.length - 2]; if (parent) loadFolder(parent.id, parent.name); else loadFolder('root') }

function toggleSelection(file: DriveFilePublic) {
  const isFolder = file.mimeType === 'application/vnd.google-apps.folder'
  if (selectionMode.value === 'single') {
    selectedFiles.value.clear()
    if (!isFolder) selectedFiles.value.add(file.id)
  } else if (selectionMode.value === 'multiple') {
    if (isFolder) return
    if (selectedFiles.value.has(file.id)) selectedFiles.value.delete(file.id)
    else selectedFiles.value.add(file.id)
  } else if (selectionMode.value === 'folder') {
    if (isFolder) navigateToFolder(file.id, file.name)
  }
}

function handleDoubleClick(file: DriveFilePublic) {
  if (file.mimeType === 'application/vnd.google-apps.folder') navigateToFolder(file.id, file.name)
  else if (selectionMode.value === 'single') confirmSelection()
}

async function confirmSelection() {
  if (selectedFiles.value.size === 0) return
  loadMessage.value = 'Downloading files...'
  try {
    const fileIds = Array.from(selectedFiles.value)
    const mediaFiles = await downloadFiles(fileIds)
    emit('select', mediaFiles)
    close()
  } catch (err) { console.error('Failed to download selected files:', err) }
}

async function selectCurrentFolder() {
  if (currentFolderId.value === 'root') return
  loadMessage.value = 'Fetching all media from folder...'
  try {
    const mediaFiles = await fetchFolderMedia(currentFolderId.value, (current, total) => {
      loadMessage.value = `Downloading ${current} / ${total} files...`
    })
    emit('select', mediaFiles)
    close()
  } catch (err) { console.error('Failed to fetch folder media:', err) }
}

function toggleViewMode() { viewMode.value = viewMode.value === 'grid' ? 'list' : 'grid' }

watch(() => props.open, (open) => { if (open) { selectedFiles.value.clear(); searchQuery.value = ''; loadFolder('root') } })
watch(() => props.selectionMode, (mode) => { if (mode) selectionMode.value = mode; selectedFiles.value.clear() })
onMounted(() => { if (props.open) loadFolder('root') })
</script>
