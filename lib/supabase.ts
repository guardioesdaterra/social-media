import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase singleton (browser).
 *
 * O `supabaseUrl`/`supabaseKey` são públicos por definição (anon key).
 * A autorização real acontece nas edge functions + RLS.
 */
let client: SupabaseClient | null = null
let supabaseUrl: string | null = null
let supabaseKey: string | null = null

/** Reads runtime config once (during setup) and caches it, so edge
 *  functions can build URLs later without calling useRuntimeConfig outside
 *  an active Nuxt/Vue setup context. */
function loadConfig(): void {
  if (supabaseUrl !== null && supabaseKey !== null) return
  const cfg = useRuntimeConfig().public
  supabaseUrl = String(cfg.supabaseUrl || '').trim()
  supabaseKey = String(cfg.supabaseKey || '').trim()
}

export function useSupabase(): SupabaseClient {
  if (client) return client

  loadConfig()
  const url = supabaseUrl!
  const key = supabaseKey!

  if (!url || !key) {
    // Nunca lança em SSR: o shell estático renderiza a tela de "config faltando".
    console.error('[supabase] NUXT_PUBLIC_SUPABASE_URL / NUXT_PUBLIC_SUPABASE_KEY não configurados')
  }

  client = createClient(url || 'https://invalid.supabase.co', key || 'anon-missing', {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: true,
      storageKey: 'eg-social-auth',
    },
    global: {
      headers: { 'x-client-info': 'eg-social-media/1.0' },
    },
  })

  return client
}

/** Full URL for a Supabase Edge Function (cross-origin from GitHub Pages). */
export function edgeFunctionUrl(path: string): string {
  loadConfig()
  const url = supabaseUrl!
  return `${url.replace(/\/+$/, '')}/functions/v1/${path.replace(/^\/+/, '')}`
}
