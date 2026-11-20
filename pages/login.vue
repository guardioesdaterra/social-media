<template>
  <LoginScreen />
</template>

<script setup lang="ts">
const { phase, bootstrap } = useSupabaseAuth()
const router = useRouter()

onMounted(async () => {
  await bootstrap()
  if (phase.value === 'manager') await router.replace('/calendario')
})
</script>
