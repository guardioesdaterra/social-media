<template>
  <div class="p-4">
    <CalendarMonth
      :cursor="cursor"
      :selected="cursor"
      :posts-by-day="byDay"
      :topics="topics"
      @select="cursor = $event"
    />
  </div>
</template>

<script setup lang="ts">
import CalendarMonth from '~/components/CalendarMonth.vue'
import type { CalendarPost, Topic } from '~/lib/types'
import { todayIso } from '~/lib/calendar'

const cursor = ref(todayIso())
const topics: Topic[] = [
  {
    key: 'a',
    label: 'A',
    description: '',
    color: '#22c55e',
    emoji: '🌱',
    sort: 0,
    needs_attention: false,
    attention_rank: null,
  },
]
const posts: CalendarPost[] = []
const byDay = computed(() => {
  const m = new Map<string, CalendarPost[]>()
  for (const p of posts) m.set(p.day, [p])
  return m
})
</script>
