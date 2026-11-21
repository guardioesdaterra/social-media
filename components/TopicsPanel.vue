<template>
  <div class="space-y-4">
    <!-- Topics needing attention (ordered #1, #2, ...) -->
    <section class="eg-card overflow-hidden">
      <div class="flex items-center justify-between gap-2 border-b border-[var(--eg-border)] px-3 py-2.5">
        <h2 class="text-sm font-semibold text-white">Topics needing attention</h2>
        <button
          class="eg-btn-ghost !px-2 !py-1.5 text-[10px]"
          @click="showAddFromAll = !showAddFromAll"
        >
          {{ showAddFromAll ? 'Hide' : 'Add from all' }}
        </button>
      </div>

      <div class="p-3 space-y-2">
        <div v-if="attention.length === 0" class="rounded-xl border border-[var(--eg-border)] bg-white/[0.02] p-3 text-center">
          <p class="text-xs text-zinc-500">No topics flagged for attention.</p>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="(t, i) in attention"
            :key="t.key"
            class="flex items-center gap-2 bg-white/[0.02] rounded-lg p-2"
          >
            <span class="shrink-0 text-xl" aria-hidden="true">{{ t.emoji }}</span>

            <div class="flex-1 min-w-0">
              <div class="flex items-baseline gap-1">
                <span class="flex-shrink-0 text-[10px] font-bold text-zinc-500">#{{ i + 1}}</span>
                <span class="text-sm font-medium text-white truncate" :title="t.label">{{ t.label }}</span>
              </div>
              <p class="text-[10px] text-zinc-500 truncate max-w-[70%]">{{ t.description }}</p>
            </div>

            <div class="flex items-center gap-1">
              <button
                v-if="i > 0"
                class="eg-btn-ghost !px-1.5 !py-1 text-[10px] text-zinc-400 hover:text-white"
                @click="moveAttention(i, i - 1)"
                aria-label="Move up"
              >
                ▲
              </button>
              <button
                v-if="i < attention.length - 1"
                class="eg-btn-ghost !px-1.5 !py-1 text-[10px] text-zinc-400 hover:text-white"
                @click="moveAttention(i, i + 1)"
                aria-label="Move down"
              >
                ▼
              </button>
              <button
                class="eg-btn-ghost !px-1.5 !py-1 text-[10px] text-red-400 hover:text-red-300"
                @click="removeAttention(t.key)"
                aria-label="Remove from list"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <div v-if="showAddFromAll" class="mt-2 pt-2 border-t border-[var(--eg-border)]">
          <p class="text-[10px] text-zinc-500 mb-2">Add a topic to the attention list:</p>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="t in remainingTopics"
              :key="t.key"
              class="eg-btn-ghost !px-2 !py-1.5 text-[10px] text-left"
              @click="addAttention(t.key)"
            >
              {{ t.emoji }} {{ t.label }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- All topics -->
    <section class="eg-card overflow-hidden">
      <div class="flex items-center justify-between gap-2 border-b border-[var(--eg-border)] px-3 py-2.5">
        <h2 class="text-sm font-semibold text-white">All topics</h2>
      </div>

      <div class="p-3 space-y-2">
        <div
          v-for="t in topics"
          :key="t.key"
          class="flex items-center justify-between gap-2 bg-white/[0.02] rounded-lg p-2 group"
        >
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <span class="shrink-0 text-lg" aria-hidden="true">{{ t.emoji }}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-baseline gap-1">
                <span class="text-[10px] font-semibold text-zinc-400">sort {{ t.sort }}</span>
                <span v-if="t.needs_attention" class="text-[9px] px-1.5 py-0 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">#{{ t.attention_rank }}</span>
              </div>
              <span class="block text-sm font-medium text-white truncate" :title="t.label">{{ t.label }}</span>
              <p class="text-[10px] text-zinc-500 truncate">{{ t.description }}</p>
            </div>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <button
              class="eg-btn-ghost !px-1.5 !py-1 text-[10px] text-zinc-400 hover:text-white"
              @click="editTopic(t)"
              aria-label="Edit topic"
            >
              ✎
            </button>
            <button
              v-if="!hasPosts(t.key)"
              class="eg-btn-ghost !px-1.5 !py-1 text-[10px] text-red-400 hover:text-red-300"
              @click="removeTopic(t.key)"
              aria-label="Delete topic"
            >
              ✕
            </button>
            <button
              v-else
              class="eg-btn-ghost !px-1.5 !py-1 text-[10px] text-zinc-500 cursor-not-allowed"
              title="Topic is used by posts — re-link them first"
              aria-disabled="true"
            >
              ✕
            </button>
          </div>
        </div>

        <div class="border-t border-[var(--eg-border)] pt-2">
          <button
            class="eg-btn-ghost w-full !px-3 !py-1.5 text-xs text-left"
            @click="editTopic(null)"
          >
            + Add new topic
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Topic } from '~/lib/types'
import { computed, ref } from 'vue'

const props = defineProps<{
  topics: readonly Topic[]
}>()

const emit = defineEmits<{
  save: [topic: Topic]
  delete: [key: string]
  reorder: [items: { key: string; sort: number }[]]
  'set-attention': [items: { key: string; attention_rank: number | null }[]]
}>()

const showAddFromAll = ref(false)

const attention = computed(() =>
  props.topics
    .filter((t) => t.needs_attention && t.attention_rank != null)
    .sort((a, b) => (a.attention_rank ?? 0) - (b.attention_rank ?? 0)),
)

const remainingTopics = computed(() =>
  props.topics.filter((t) => !(t.needs_attention && t.attention_rank != null)),
)

const topicIds = computed(() => new Set(props.topics.map((t) => t.key)))

function hasPosts(key: string): boolean {
  // Can't know here — rely on server 409. Keep UI optimistic; disable visually if we knew.
  return false
}

function moveAttention(from: number, to: number) {
  const list = attention.value
  const [moved] = list.splice(from, 1)
  if (!moved) return
  list.splice(to, 0, moved)
  const items = list.map((t, i) => ({ key: t.key, sort: i + 1 }))
  emit('reorder', items)
}

function addAttention(key: string) {
  const t = props.topics.find((x) => x.key === key)
  if (!t) return
  const nextRank = (attention.value.length || 0) + 1
  const items = [
    ...attention.value.map((x) => ({ key: x.key, attention_rank: (attention.value.indexOf(x) || 0) + 1 })),
    { key, attention_rank: nextRank },
  ]
  emit('set-attention', items)
  showAddFromAll.value = false
}

function removeAttention(key: string) {
  const items = attention.value
    .filter((t) => t.key !== key)
    .map((t, i) => ({ key: t.key, attention_rank: i + 1 }))
  emit('set-attention', items)
}

function editTopic(topic: Topic | null) {
  const draft = topic
    ? { ...topic }
    : {
        key: '',
        label: '',
        description: '',
        color: '#22C55E',
        emoji: '•',
        sort: (Math.max(...props.topics.map((t) => t.sort), 0) || 0) + 1,
        needs_attention: false,
        attention_rank: null,
      }
  const next = prompt('Enter topic label:', draft.label)
  if (next === null) return
  const key = prompt('Enter topic key (lowercase, digits, hyphens):', draft.key)
  if (key === null) return
  const color = prompt('Hex color (e.g. #22C55E):', draft.color)
  if (color === null) return
  const emoji = prompt('Emoji (e.g. 🌍):', draft.emoji)
  if (emoji === null) return

  emit('save', {
    key: key.trim().toLowerCase() || draft.key,
    label: next.trim() || draft.label,
    description: draft.description,
    color: color.trim() || draft.color,
    emoji: emoji.trim() || draft.emoji,
    sort: draft.sort,
    needs_attention: draft.needs_attention,
    attention_rank: draft.attention_rank,
  })
}

async function removeTopic(key: string) {
  if (!key || !window.confirm('Delete this topic? Posts linked to it must be re-linked first.')) return
  emit('delete', key)
}
</script>
