<template>
  <div id="app" class="flex min-h-full flex-col">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <ContextMenuHost />
    <ToastHost />
    <!-- Exit-intent social CTA popup — suppressed when a staff session is active -->
    <ExitIntentPopup :disabled="isManager" />
  </div>
</template>

<script setup lang="ts">
useHead({ htmlAttrs: { lang: 'pt-BR' } })

const { phase, isManager } = useSupabaseAuth()
</script>
