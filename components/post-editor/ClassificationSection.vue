<template>
  <section class="eg-section">
    <div class="flex items-center gap-2">
      <h3 class="eg-section-title">Classification</h3>
      <span class="ml-auto flex h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
    </div>
    <p class="eg-section-sub">Topic, format and workflow status.</p>
    <div class="mt-5 space-y-4">
      <div class="space-y-2">
        <label class="eg-field-label" for="pe-topic">Topic <span class="req">*</span></label>
        <select
          id="pe-topic"
          class="eg-select"
          :value="form.topic_key"
          @change="form.topic_key = ($event.target as HTMLSelectElement).value"
          required
          :disabled="readonly"
        >
          <option disabled value="">Select a topic</option>
          <option v-for="t in topics" :key="t.key" :value="t.key">{{ t.emoji }} {{ t.label }}</option>
        </select>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="space-y-2">
          <label class="eg-field-label" for="pe-format">Format</label>
          <select id="pe-format" class="eg-select" v-model="form.format" :disabled="readonly">
            <option v-for="f in FORMATS" :key="f" :value="f">{{ f }}</option>
          </select>
        </div>
        <div class="space-y-2">
          <label class="eg-field-label" for="pe-status">Status</label>
          <select id="pe-status" class="eg-select" v-model="form.status" :disabled="readonly">
            <option v-for="s in STATUSES" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { PostFormat, PostStatus, Topic } from '~/lib/types'
import { FORMATS, STATUSES } from '~/lib/types'
import type { PostForm } from './types'

const props = defineProps<{ form: PostForm; topics: readonly Topic[]; readonly?: boolean }>()
</script>
