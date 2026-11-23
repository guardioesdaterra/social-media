<template>
  <div class="wayback-picker">
    <!-- URL input -->
    <div class="mb-3">
      <label for="wb-url" class="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-wider">
        Wayback Snapshot
      </label>
      <div class="flex gap-2">
        <input
          id="wb-url"
          type="url"
          class="eg-input text-sm flex-1"
          v-model="urlInput"
          placeholder="https://earthguardians.org/page"
          @keyup.enter="loadSnapshots"
        />
        <button
          class="eg-btn-primary !px-3 !py-1.5 text-xs whitespace-nowrap"
          :disabled="loading || !urlInput"
          @click="loadSnapshots"
        >
          {{ loading ? '...' : 'Find' }}
        </button>
        <button
          class="eg-btn-ghost !px-3 !py-1.5 text-xs whitespace-nowrap"
          :disabled="capturing || !urlInput"
          @click="captureNow"
          title="Capture now on Wayback Machine"
        >
          {{ capturing ? '...' : '📸' }}
        </button>
      </div>
    </div>

    <!-- Capture result -->
    <div v-if="captureResult" class="mb-3 rounded-lg bg-green-500/10 border border-green-500/30 p-2 text-xs">
      <div class="flex items-center justify-between">
        <span class="text-green-300">{{ captureResult.message }}</span>
        <a
          :href="captureResult.url"
          target="_blank"
          rel="noopener"
          class="text-[var(--eg-accent)] hover:underline"
        >
          View ↗
        </a>
      </div>
    </div>

    <!-- Error message -->
    <div v-if="error" class="mb-3 rounded-lg bg-red-500/10 border border-red-500/30 p-2 text-xs text-red-300">
      {{ error }}
    </div>

    <!-- Snapshots list -->
    <div v-if="snapshots.length > 0" class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-[10px] text-zinc-500">
          {{ snapshots.length }} snapshots with unique content
        </span>
        <span class="text-[10px] text-zinc-500">
          {{ formatDateRange }}
        </span>
      </div>

      <!-- Snapshot items -->
      <div class="max-h-64 overflow-y-auto space-y-1 pr-1">
        <button
          v-for="(snap, i) in snapshots"
          :key="snap.timestamp"
          class="w-full text-left p-2 rounded-lg border transition-all"
          :class="[
            selectedTimestamps.includes(snap.timestamp)
              ? 'border-[var(--eg-accent)] bg-[var(--eg-accent)]/10'
              : 'border-[var(--eg-border)] hover:border-zinc-600'
          ]"
          @click="selectSnapshot(snap)"
        >
          <div class="flex items-center gap-2">
            <input
              type="checkbox"
              :checked="selectedTimestamps.includes(snap.timestamp)"
              class="rounded border-zinc-600"
              @click.stop
              @change="toggleSelection(snap)"
            />
            <div class="flex-1 min-w-0">
              <div class="text-xs text-white font-medium">
                {{ formatDate(snap.timestamp) }}
              </div>
              <div class="text-[10px] text-zinc-500 truncate">
                {{ snap.mimetype }}
              </div>
            </div>
            <a
              :href="getReplayUrl(snap.timestamp)"
              target="_blank"
              rel="noopener"
              class="text-[10px] text-[var(--eg-accent)] hover:underline"
              @click.stop
            >
              ↗
            </a>
          </div>
        </button>
      </div>

      <!-- Selected count -->
      <div v-if="selectedTimestamps.length > 0" class="text-[10px] text-zinc-400 pt-2 border-t border-[var(--eg-border)]">
        {{ selectedTimestamps.length }} snapshots selected for comparison
      </div>

      <!-- View diff button -->
      <button
        v-if="selectedTimestamps.length >= 2"
        class="eg-btn-primary w-full !py-2 text-xs mt-2"
        @click="viewDiff"
      >
        Compare Selected ({{ selectedTimestamps.length }} snapshots)
      </button>
    </div>

    <!-- No results -->
    <div v-else-if="!loading && hasSearched" class="text-center py-4 text-zinc-500 text-sm">
      No snapshots found. Try a different URL or check if the site exists.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { WaybackSnapshot } from '~/composables/useWayback'
import { useWaybackCapture } from '~/composables/useWaybackCapture'

const props = defineProps<{
  modelValue?: string // Initial URL
  prefillUrl?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [url: string]
  'snapshots': [snapshots: WaybackSnapshot[]]
  'select': [snap: WaybackSnapshot]
  'compare': [snapshots: WaybackSnapshot[]]
  'captured': [url: string]
}>()

const urlInput = ref(props.prefillUrl || props.modelValue || '')
const loading = ref(false)
const error = ref<string | null>(null)
const snapshots = ref<WaybackSnapshot[]>([])
const selectedTimestamps = ref<string[]>([])
const hasSearched = ref(false)

const { capturing, error: captureError, lastResult: captureResult, capture } = useWaybackCapture()

const wayback = useWayback()

const formatDateRange = computed(() => {
  const items = snapshots.value
  const first = items[items.length - 1]
  const last = items[0]
  if (!first || !last) return ''
  return `${formatDate(first.timestamp)} → ${formatDate(last.timestamp)}`
})

function formatDate(timestamp: string): string {
  if (!timestamp) return 'N/A'
  const year = timestamp.slice(0, 4)
  const month = timestamp.slice(4, 6)
  const day = timestamp.slice(6, 8)
  return `${year}-${month}-${day}`
}

function getReplayUrl(timestamp: string): string {
  return wayback.getReplayUrl(urlInput.value, timestamp)
}

async function loadSnapshots() {
  if (!urlInput.value) return

  loading.value = true
  error.value = null
  hasSearched.value = true
  selectedTimestamps.value = []

  try {
    // Normalize URL
    let normalizedUrl = urlInput.value
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl
    }

    const results = await wayback.getSnapshots(normalizedUrl, { limit: 50 })
    snapshots.value = results
    
    emit('update:modelValue', normalizedUrl)
    emit('snapshots', results)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load snapshots'
  } finally {
    loading.value = false
  }
}

function toggleSelection(snap: WaybackSnapshot) {
  const idx = selectedTimestamps.value.indexOf(snap.timestamp)
  if (idx >= 0) {
    selectedTimestamps.value.splice(idx, 1)
  } else {
    // Keep max 10 snapshots for comparison
    if (selectedTimestamps.value.length >= 10) {
      selectedTimestamps.value.shift()
    }
    selectedTimestamps.value.push(snap.timestamp)
  }
}

function selectSnapshot(snap: WaybackSnapshot) {
  emit('select', snap)
}

function viewDiff() {
  const selected = snapshots.value
    .filter(s => selectedTimestamps.value.includes(s.timestamp))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  
  emit('compare', selected)
}

async function captureNow() {
  if (!urlInput.value) return

  // Normalize URL
  let normalizedUrl = urlInput.value
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl
  }
  urlInput.value = normalizedUrl

  const result = await capture(normalizedUrl)
  if (result) {
    emit('captured', normalizedUrl)
    // Refresh snapshots after capture
    await loadSnapshots()
  }
}

// Preload if URL provided
if (props.prefillUrl || props.modelValue) {
  loadSnapshots()
}
</script>