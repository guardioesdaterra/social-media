<template>
  <div class="diff-viewer">
    <!-- Header with snapshot info -->
    <div class="flex items-center justify-between gap-2 mb-3 px-1">
      <div class="flex items-center gap-2">
        <button
          class="eg-btn-ghost !px-2 !py-1 text-[10px]"
          @click="goToPrev"
          :disabled="!canGoPrev"
        >
          ← Prev
        </button>
        <span class="text-[11px] text-zinc-400">
          {{ currentIndex + 1 }} / {{ snapshots.length }}
        </span>
        <button
          class="eg-btn-ghost !px-2 !py-1 text-[10px]"
          @click="goToNext"
          :disabled="!canGoNext"
        >
          Next →
        </button>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-zinc-500">
          {{ currentFrom }} → {{ currentTo }}
        </span>
        <a
          :href="replayUrl"
          target="_blank"
          rel="noopener"
          class="text-[10px] text-[var(--eg-accent)] hover:underline"
        >
          View on Wayback ↗
        </a>
      </div>
    </div>

    <!-- Side-by-side iframes -->
    <div class="grid grid-cols-2 gap-2 h-[500px]">
      <!-- Before version -->
      <div class="relative flex flex-col">
        <div class="text-[10px] text-zinc-500 mb-1 px-1">
          {{ formatDate(currentFrom) }} (before)
        </div>
        <div class="flex-1 border border-[var(--eg-border)] rounded-lg overflow-hidden bg-zinc-900">
          <iframe
            v-if="iframeUrlFrom"
            :src="iframeUrlFrom"
            class="w-full h-full border-0"
            sandbox="allow-same-origin allow-scripts"
            loading="lazy"
            title="Previous version"
          />
          <div v-else class="flex items-center justify-center h-full text-zinc-500 text-sm">
            No snapshot
          </div>
        </div>
      </div>

      <!-- After version -->
      <div class="relative flex flex-col">
        <div class="text-[10px] text-zinc-500 mb-1 px-1">
          {{ formatDate(currentTo) }} (after)
        </div>
        <div class="flex-1 border border-[var(--eg-border)] rounded-lg overflow-hidden bg-zinc-900">
          <iframe
            v-if="iframeUrlTo"
            :src="iframeUrlTo"
            class="w-full h-full border-0"
            sandbox="allow-same-origin allow-scripts"
            loading="lazy"
            title="Current version"
          />
          <div v-else class="flex items-center justify-center h-full text-zinc-500 text-sm">
            No snapshot
          </div>
        </div>
      </div>
    </div>

    <!-- Text diff summary -->
    <div v-if="diff" class="mt-3 px-1">
      <div class="text-[10px] text-zinc-500 mb-2">
        Text changes: 
        <span class="text-red-400">-{{ diff.deletions.length }} lines</span>
        <span class="mx-1">/</span>
        <span class="text-green-400">+{{ diff.additions.length }} lines</span>
        <span class="mx-1">/</span>
        <span class="text-zinc-400">{{ diff.unchanged }} unchanged</span>
      </div>
      
      <!-- Collapsible detailed diff -->
      <details v-if="diff.deletions.length || diff.additions.length" class="text-[10px]">
        <summary class="cursor-pointer text-zinc-400 hover:text-white mb-2">
          Show text diff
        </summary>
        <div class="max-h-48 overflow-y-auto bg-zinc-950 rounded p-2 font-mono text-[9px] leading-relaxed">
          <div v-for="(chunk, i) in diff.deletions.slice(0, 10)" :key="'d-' + i" class="text-red-400/80">
            - {{ chunk.value.slice(0, 100) }}{{ chunk.value.length > 100 ? '...' : '' }}
          </div>
          <div v-for="(chunk, i) in diff.additions.slice(0, 10)" :key="'a-' + i" class="text-green-400/80">
            + {{ chunk.value.slice(0, 100) }}{{ chunk.value.length > 100 ? '...' : '' }}
          </div>
          <div v-if="diff.deletions.length > 10 || diff.additions.length > 10" class="text-zinc-500 mt-1">
            ... and {{ diff.deletions.length - 10 + diff.additions.length - 10 }} more changes
          </div>
        </div>
      </details>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="absolute inset-0 bg-black/50 flex items-center justify-center">
      <div class="flex flex-col items-center gap-2">
        <span class="h-6 w-6 animate-spin rounded-full border-2 border-[var(--eg-accent)] border-t-transparent" />
        <span class="text-xs text-zinc-400">Loading diff...</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { WaybackSnapshot, WaybackDiff } from '~/composables/useWayback'

const props = defineProps<{
  snapshots: WaybackSnapshot[]
  url: string
  initialIndex?: number
}>()

const emit = defineEmits<{
  change: [from: WaybackSnapshot, to: WaybackSnapshot]
}>()

const currentIndex = ref(props.initialIndex ?? 0)
const diff = ref<WaybackDiff | null>(null)
const loading = ref(false)

// Computed
const canGoPrev = computed(() => currentIndex.value > 0)
const canGoNext = computed(() => currentIndex.value < props.snapshots.length - 1)

const currentFrom = computed(() => {
  if (currentIndex.value > 0) {
    return props.snapshots[currentIndex.value - 1].timestamp
  }
  return ''
})

const currentTo = computed(() => {
  if (currentIndex.value < props.snapshots.length) {
    return props.snapshots[currentIndex.value].timestamp
  }
  return ''
})

const iframeUrlFrom = computed(() => {
  if (!currentFrom.value) return ''
  return `https://web.archive.org/web/${currentFrom.value}/${props.url}`
})

const iframeUrlTo = computed(() => {
  if (!currentTo.value) return ''
  return `https://web.archive.org/web/${currentTo.value}/${props.url}`
})

const replayUrl = computed(() => {
  if (currentTo.value) {
    return `https://web.archive.org/web/${currentTo.value}/${props.url}`
  }
  return `https://web.archive.org/web/2/${props.url}`
})

// Methods
function goToPrev() {
  if (canGoPrev.value) {
    currentIndex.value--
    loadDiff()
  }
}

function goToNext() {
  if (canGoNext.value) {
    currentIndex.value++
    loadDiff()
  }
}

function formatDate(timestamp: string): string {
  if (!timestamp) return 'N/A'
  // timestamp format: 20240101000000
  const year = timestamp.slice(0, 4)
  const month = timestamp.slice(4, 6)
  const day = timestamp.slice(6, 8)
  return `${year}-${month}-${day}`
}

async function loadDiff() {
  if (!currentFrom.value || !currentTo.value) {
    diff.value = null
    return
  }

  loading.value = true
  try {
    const wayback = useWayback()
    diff.value = await wayback.getDiff(props.url, currentFrom.value, currentTo.value)
    
    emit('change', props.snapshots[currentIndex.value - 1], props.snapshots[currentIndex.value])
  } catch (e) {
    console.error('Failed to load diff:', e)
    diff.value = null
  } finally {
    loading.value = false
  }
}

// Watch for snapshot changes
watch(() => props.snapshots, () => {
  currentIndex.value = Math.min(currentIndex.value, Math.max(0, props.snapshots.length - 1))
  if (props.snapshots.length >= 2) {
    loadDiff()
  }
}, { immediate: true })
</script>