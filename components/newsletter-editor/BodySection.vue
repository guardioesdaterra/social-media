<template>
  <section class="eg-section">
    <div class="flex items-baseline justify-between gap-2">
      <div>
        <h3 class="eg-section-title">Body</h3>
        <p class="eg-section-sub">HTML content of the email.</p>
      </div>
      <span class="text-[11px] tabular-nums text-zinc-600">{{ form.body.length }} chars</span>
    </div>
    <div class="mt-4">
      <textarea
        id="nl-body"
        aria-label="Body HTML"
        class="eg-textarea font-mono text-[13px]"
        rows="14"
        :value="form.body"
        @input="form.body = ($event.target as HTMLTextAreaElement).value"
        placeholder="<p>Greetings EG Family!</p>..."
        required
      ></textarea>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { NewsletterForm } from './types'

defineProps<{ form: NewsletterForm }>()
</script>
