import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase singleton (browser).
 *
 * O `supabaseUrl`/`supabaseKey` são públicos por definição (anon key).
 * A autorização real acontece nas edge functions + RLS.
 */
let client: SupabaseClient | null = null

export function useSupabase(): SupabaseClient {
  if (client) return client

  const cfg = useRuntimeConfig().public
  const url = String(cfg.supabaseUrl || '').trim()
  const key = String(cfg.supabaseKey || '').trim()

  if (!url || !key) {
    // Nunca lança em SSR: o shell estático renderiza a tela de "config faltando".
    console.error('[supabase] NUXT_PUBLIC_SUPABASE_URL / NUXT_PUBLIC_SUPABASE_KEY não configurados')
  }

  client = createClient(url || 'https://invalid.supabase.co', key || 'anon-missing', {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'eg-social-auth',
    },
    global: {
      headers: { 'x-client-info': 'eg-social-media/1.0' },
    },
  })

  return client
}
