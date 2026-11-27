<template>
  <section class="eg-section">
    <div class="flex items-center gap-2">
      <h3 class="eg-section-title">Details</h3>
      <span class="ml-auto flex h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
    </div>
    <p class="eg-section-sub">Title, slug and publishing status.</p>
    <div class="mt-5 space-y-4">
      <div class="space-y-2">
        <label class="eg-field-label" for="su-title">Title <span class="req">*</span></label>
        <input
          id="su-title"
          type="text"
          class="eg-field"
          :value="form.title"
          @input="form.title = ($event.target as HTMLInputElement).value"
          maxlength="200"
          placeholder="e.g. New restoration dashboard launched"
          required
        />
      </div>
      <div class="space-y-2">
        <label class="eg-field-label" for="su-slug">URL slug <span class="req">*</span></label>
        <input
          id="su-slug"
          type="text"
          class="eg-field"
          :value="form.slug"
          @input="form.slug = ($event.target as HTMLInputElement).value"
          maxlength="200"
          placeholder="e.g. restoration-dashboard"
          required
        />
        <p class="eg-hint">Lowercase, digits and hyphens only.</p>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="space-y-2">
          <label class="eg-field-label" for="su-status">Status</label>
          <select id="su-status" class="eg-select" v-model="form.status">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div v-if="form.status === 'published'" class="space-y-2">
          <label class="eg-field-label" for="su-published">Published at</label>
          <input
            id="su-published"
            type="datetime-local"
            class="eg-field [color-scheme:dark]"
            :value="form.published_at"
            @input="form.published_at = ($event.target as HTMLInputElement).value"
          />
        </div>
      </div>
      <div class="space-y-2">
        <label class="eg-field-label" for="su-url">Page URL</label>
        <input
          id="su-url"
          type="url"
          class="eg-field"
          :value="form.url"
          @input="form.url = ($event.target as HTMLInputElement).value"
          placeholder="https://earthguardians.org/restoration-dashboard"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { SiteUpdateForm } from './types'

defineProps<{ form: SiteUpdateForm }>()
</script>
