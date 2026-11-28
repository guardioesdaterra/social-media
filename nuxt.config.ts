/**
 * nuxt.config.ts
 * @why Nuxt 3 static (SSG) configuration for the Earth Guardians editorial
 *  calendar panel. Everything is client-rendered after a static shell so the
 *  Supabase session + manager gate can run in the browser (GitHub Pages has
 *  no server).
 */
const baseURL = process.env.NUXT_APP_BASE_URL || '/'

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: process.env.NODE_ENV !== 'production' },

  modules: ['@nuxtjs/tailwindcss', '@nuxt/eslint', '@vueuse/nuxt'],

  vueuse: {
    ssrHandlers: true,
  },

  ssr: false,
  routeRules: {
    // Client-side app; prerender only the shell so GitHub Pages serves a static SPA.
    '/': { prerender: true },
  },

  app: {
    baseURL,
    head: {
      title: 'Social Media · Earth Guardians',
      meta: [
        { charset: 'utf-8' },
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover',
        },
        {
          name: 'description',
          content: 'Painel editorial do calendário de posts do Instagram @earthguardians',
        },
        { name: 'theme-color', content: '#0a0a0a' },
      ],
      link: [{ rel: 'icon', type: 'image/x-icon', href: `${baseURL}favicon.ico` }],
    },
  },

  runtimeConfig: {
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || '',
      supabaseKey: process.env.NUXT_PUBLIC_SUPABASE_KEY || '',
      mock: process.env.NUXT_PUBLIC_MOCK === '1',
    },
  },

  css: ['~/assets/css/main.css'],

  typescript: {
    strict: true,
    typeCheck: false,
    shim: false,
  },

  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/', '/login', '/calendario'],
    },
  },

  experimental: { appManifest: false },

  vite: {
    server: {
      watch: {
        ignored: ['**/node_modules/**', '**/.git/**'],
      },
    },
  },
})
