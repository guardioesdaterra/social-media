<template>
  <div id="app" class="flex min-h-full flex-col">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <ContextMenuHost />
    <ToastHost />
  </div>
</template>

<script setup lang="ts">
useHead({ htmlAttrs: { lang: 'pt-BR' } })
</script>
