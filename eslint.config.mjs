import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

const eslintJs = require('@eslint/js')
const vueParser = require('vue-eslint-parser')
const tsParser = require('@typescript-eslint/parser')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const pluginVue = require('eslint-plugin-vue')

const nuxtGlobals = [
  'useHead', 'useSeoMeta', 'useServerState', 'useCookie', 'useRequestHeaders',
  'useRequestEvent', 'useFetch', 'useLazyFetch', 'useAsyncData', 'useLazyAsyncData',
  'useRoute', 'useRouter', 'useNuxtApp', 'useNuxtData', 'useNuxt', 'useRuntimeConfig',
  'useStorage', 'useLazyStorage', 'useSession', 'useSupabaseAuth',
]

export default [
  eslintJs.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: Object.fromEntries(nuxtGlobals.map((g) => [g, true])),
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: Object.fromEntries(nuxtGlobals.map((g) => [g, true])),
    },
    plugins: {
      vue: pluginVue,
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...pluginVue.configs['flat/essential'].rules,
      ...tsPlugin.configs.recommended.rules,
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    ignores: ['.nuxt', '.output', 'dist', 'node_modules'],
  },
]
