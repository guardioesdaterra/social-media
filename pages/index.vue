<template>
  <div class="grid min-h-[60vh] place-items-center">
    <div class="flex flex-col items-center gap-3">
      <span class="h-8 w-8 animate-spin rounded-full border-2 border-[var(--eg-accent)] border-t-transparent" />
      <p class="text-sm text-zinc-400">Opening the calendar…</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const { phase, bootstrap } = useSupabaseAuth()
const router = useRouter()

onMounted(async () => {
  await bootstrap()
  await router.replace(phase.value === 'manager' ? '/calendario' : '/login')
})
</script>
