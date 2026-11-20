<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <main class="mx-auto w-full max-w-[1680px] flex-1 px-3 pb-20 pt-4 sm:px-5">
      <slot />
    </main>
    <footer
      class="border-t border-[var(--eg-border)] px-4 py-4 text-center text-xs text-zinc-600"
    >
      Earth Guardians · @earthguardians · Editorial calendar
    </footer>
  </div>
</template>
