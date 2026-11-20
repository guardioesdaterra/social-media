import eslint from '@nuxt/eslint'

export default eslint.flatConfig({
  files: ['**/*.{js,mjs,cjs,ts,vue}'],
  ignores: ['.output', '.nuxt', 'dist', 'node_modules'],
})
