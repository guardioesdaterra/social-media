<template>
  <section class="eg-section">
    <div class="flex items-baseline justify-between gap-2">
      <div>
        <h3 class="eg-section-title">Content</h3>
        <p class="eg-section-sub">HTML markup of the page.</p>
      </div>
      <span class="text-[11px] tabular-nums text-zinc-600">{{ form.content.length }} chars</span>
    </div>
    <div class="mt-4">
      <textarea
        id="su-content"
        aria-label="Content HTML"
        class="eg-textarea font-mono text-[13px]"
        rows="12"
        :value="form.content"
        @input="form.content = ($event.target as HTMLTextAreaElement).value"
        placeholder="<h1>Welcome</h1><p>...</p>"
        required
      ></textarea>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { SiteUpdateForm } from './types'

defineProps<{ form: SiteUpdateForm }>()
</script>
