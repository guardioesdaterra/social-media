<template>
  <section class="eg-section">
    <div class="flex items-center gap-2">
      <h3 class="eg-section-title">Content</h3>
      <span class="ml-auto flex h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
    </div>
    <p class="eg-section-sub">What your audience will see.</p>
    <div class="mt-5 space-y-4">
      <div class="space-y-2">
        <label class="eg-field-label" for="pe-title">Title</label>
        <input
          id="pe-title"
          type="text"
          class="eg-field"
          :value="form.title"
          @input="form.title = ($event.target as HTMLInputElement).value"
          maxlength="300"
          placeholder="e.g. Giving Tuesday — matched donation"
        />
      </div>
      <div class="space-y-2">
        <div class="flex items-baseline justify-between gap-2">
          <label class="eg-field-label" for="pe-caption">Caption</label>
          <span class="text-[11px] tabular-nums" :class="form.caption.length > 9000 ? 'text-amber-400' : 'text-zinc-600'"
            >{{ form.caption.length }} / 10000</span
          >
        </div>
        <textarea
          id="pe-caption"
          class="eg-textarea"
          rows="6"
          :value="form.caption"
          @input="form.caption = ($event.target as HTMLTextAreaElement).value"
          maxlength="10000"
          placeholder="Greetings EG Family! ..."
        ></textarea>
      </div>
      <div class="space-y-2">
        <label class="eg-field-label" for="pe-hashtags">Hashtags</label>
        <input
          id="pe-hashtags"
          type="text"
          class="eg-field"
          :value="form.hashtags"
          @input="form.hashtags = ($event.target as HTMLInputElement).value"
          placeholder="#EarthGuardians #ClimateAction"
        />
        <p class="eg-hint">Space-separated.</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { PostForm } from './types'

defineProps<{ form: PostForm }>()
</script>
