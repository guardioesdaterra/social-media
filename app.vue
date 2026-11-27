<template>
  <div id="app" class="flex min-h-full flex-col">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <ContextMenuHost />
    <ToastHost />
    <OnlineNow />
    <PresenceCursor />
    <CommentaryDrawer />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { usePresence } from '~/composables/usePresence'

useHead({ htmlAttrs: { lang: 'pt-BR' } })

const { initPresence, stopPresence } = usePresence()

onMounted(() => {
  initPresence()
})

onUnmounted(() => {
  stopPresence()
})
</script>
