<template>
  <section class="eg-section">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="eg-section-title">Wayback Machine</h3>
        <p class="eg-section-sub">Snapshots and visual diffs from web.archive.org.</p>
      </div>
      <div class="eg-segmented" role="tablist" aria-label="Wayback views">
        <button
          type="button"
          role="tab"
          class="eg-segmented-item"
          :class="{ 'is-active': waybackTab === 'snapshots' }"
          :aria-selected="waybackTab === 'snapshots'"
          @click="waybackTab = 'snapshots'"
        >
          📸 Snapshots
        </button>
        <button
          type="button"
          role="tab"
          class="eg-segmented-item"
          :class="{ 'is-active': waybackTab === 'diff' }"
          :aria-selected="waybackTab === 'diff'"
          :disabled="waybackSnapshots.length < 2"
          @click="waybackTab = 'diff'"
        >
          🔄 Compare
        </button>
      </div>
    </div>

    <!-- Snapshots Tab -->
    <div v-if="waybackTab === 'snapshots'" class="mt-4 space-y-4">
      <WaybackPicker
        :prefill-url="form.url || undefined"
        @snapshots="onSnapshotsLoaded"
        @select="onSelectSnapshot"
        @compare="onCompareSnapshots"
      />

      <!-- Snapshot preview iframe -->
      <div v-if="previewSnapshot" class="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black">
        <div class="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-3 py-2 backdrop-blur">
          <span class="text-xs text-zinc-400">Preview: {{ formatSnapshotDate(previewSnapshot.timestamp) }}</span>
          <button type="button" class="eg-icon-btn h-6 w-6" aria-label="Close preview" @click="previewSnapshot = null">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="relative h-[500px] w-full">
          <iframe
            :src="previewReplayUrl"
            class="h-full w-full"
            sandbox="allow-same-origin allow-scripts"
            title="Wayback snapshot preview"
          />
        </div>
        <a
          :href="previewReplayUrl"
          target="_blank"
          rel="noopener"
          class="block border-t border-white/10 px-3 py-2 text-xs text-[var(--eg-accent)] transition hover:bg-white/5 hover:underline"
        >
          Open in new tab ↗
        </a>
      </div>
    </div>

    <!-- Diff Tab -->
    <div v-if="waybackTab === 'diff' && waybackSnapshots.length >= 2" class="mt-4">
      <DiffViewer
        :snapshots="waybackSnapshots"
        :url="form.url || ''"
        @change="onDiffChange"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { SiteUpdateForm } from './types'
import type { WaybackSnapshot, WaybackDiff } from '~/composables/useWayback'
import { ref, computed } from 'vue'
import WaybackPicker from '../WaybackPicker.vue'
import DiffViewer from '../DiffViewer.vue'

const props = defineProps<{ form: SiteUpdateForm }>()

const waybackTab = ref<'snapshots' | 'diff'>('snapshots')
const waybackSnapshots = ref<WaybackSnapshot[]>([])
const previewSnapshot = ref<WaybackSnapshot | null>(null)

const previewReplayUrl = computed(() => {
  if (!previewSnapshot.value || !props.form.url) return ''
  return `https://web.archive.org/web/${previewSnapshot.value.timestamp}/${props.form.url}`
})

function onSnapshotsLoaded(snapshots: WaybackSnapshot[]) {
  waybackSnapshots.value = snapshots
  props.form.snapshot_timestamps = snapshots.map(s => s.timestamp)
}

function onSelectSnapshot(snap: WaybackSnapshot) {
  previewSnapshot.value = snap
  waybackTab.value = 'snapshots'
}

function onCompareSnapshots(snapshots: WaybackSnapshot[]) {
  waybackSnapshots.value = snapshots
  waybackTab.value = 'diff'
}

function onDiffChange(from: WaybackSnapshot, to: WaybackSnapshot) {
  props.form.last_diff = JSON.stringify({
    from: from.timestamp,
    to: to.timestamp,
    url: props.form.url,
  })
}

function formatSnapshotDate(timestamp: string): string {
  if (!timestamp) return ''
  const year = timestamp.slice(0, 4)
  const month = timestamp.slice(4, 6)
  const day = timestamp.slice(6, 8)
  return `${year}-${month}-${day}`
}
</script>
