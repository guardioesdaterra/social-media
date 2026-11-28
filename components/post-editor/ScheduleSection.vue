<template>
  <section class="eg-section">
    <div class="flex items-center gap-2">
      <h3 class="eg-section-title">Schedule</h3>
      <span class="ml-auto flex h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
    </div>
    <p class="eg-section-sub">When this post should go live.</p>
    <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="space-y-2">
        <label class="eg-field-label" for="pe-date">Publish date <span class="req">*</span></label>
        <input
          id="pe-date"
          type="date"
          class="eg-field"
          :value="form.day"
          @input="form.day = ($event.target as HTMLInputElement).value"
          required
          :disabled="readonly"
        />
        <p class="eg-hint">All-day post when no time is set.</p>
      </div>
      <div class="space-y-2">
        <label class="eg-field-label" for="pe-time">Scheduled time</label>
        <input
          id="pe-time"
          type="time"
          class="eg-field"
          :value="form.scheduled_at ?? ''"
          @input="form.scheduled_at = ($event.target as HTMLInputElement).value || null"
          :disabled="readonly"
        />
        <p class="eg-hint">Leave blank for an all-day post.</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { PostForm } from './types'

defineProps<{ form: PostForm; readonly?: boolean }>()
</script>
