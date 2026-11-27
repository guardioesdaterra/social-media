<template>
  <section class="eg-section">
    <div class="flex items-center gap-2">
      <h3 class="eg-section-title">Details</h3>
      <span class="ml-auto flex h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
    </div>
    <p class="eg-section-sub">Subject line and delivery status.</p>
    <div class="mt-5 space-y-4">
      <div class="space-y-2">
        <label class="eg-field-label" for="nl-title">Title <span class="req">*</span></label>
        <input
          id="nl-title"
          type="text"
          class="eg-field"
          :value="form.title"
          @input="form.title = ($event.target as HTMLInputElement).value"
          maxlength="200"
          placeholder="e.g. December 2026 — Year in Review"
          required
        />
      </div>
      <div class="space-y-2">
        <label class="eg-field-label" for="nl-subject">Email subject <span class="req">*</span></label>
        <input
          id="nl-subject"
          type="text"
          class="eg-field"
          :value="form.subject"
          @input="form.subject = ($event.target as HTMLInputElement).value"
          maxlength="200"
          placeholder="e.g. Our year in review + what's next"
          required
        />
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="space-y-2">
          <label class="eg-field-label" for="nl-status">Status</label>
          <select id="nl-status" class="eg-select" v-model="form.status">
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="sent">Sent</option>
          </select>
        </div>
        <div v-if="form.status === 'scheduled'" class="space-y-2">
          <label class="eg-field-label" for="nl-scheduled">Scheduled at</label>
          <input
            id="nl-scheduled"
            type="datetime-local"
            class="eg-field [color-scheme:dark]"
            :value="form.scheduled_at"
            @input="form.scheduled_at = ($event.target as HTMLInputElement).value"
          />
        </div>
      </div>
      <div class="space-y-2">
        <label class="eg-field-label" for="nl-recipients">Recipients</label>
        <input
          id="nl-recipients"
          type="text"
          class="eg-field"
          :value="form.recipient_list"
          @input="form.recipient_list = ($event.target as HTMLInputElement).value"
          placeholder="newsletter@earthguardians.org, updates@earthguardians.org"
        />
        <p class="eg-hint">Comma-separated emails. Leave blank to use the default mailing list.</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { NewsletterForm } from './types'

defineProps<{ form: NewsletterForm }>()
</script>
