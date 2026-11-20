/**
 * supabase/functions/is-manager/index.ts
 * @why Authoritative manager check — validates the caller's JWT server-side
 *  and answers whether the account is an Earth Guardians staff address.
 *  The client gate (useSupabaseAuth) treats this as the source of truth.
 *
 * Deploy:
 *   supabase functions deploy is-manager --project-ref eghddkeceomhwkaefqrq
 * Secrets (dashboard → Edge Functions → Secrets):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, fail, json } from '../_shared/cors.ts'
import { EG_EMAIL_DOMAIN } from '../_shared/auth.ts'

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8777',
  'https://guardioesdaterra.github.io',
  'https://earthguardians.org',
]

function headers(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || ''
  const allow =
    (origin && ALLOWED_ORIGINS.includes(origin)) ||
    (() => {
      try {
        const host = new URL(origin).hostname.toLowerCase()
        return host === EG_EMAIL_DOMAIN || host.endsWith(`.${EG_EMAIL_DOMAIN}`)
      } catch {
        return false
      }
    })()
      ? origin
      : ALLOWED_ORIGINS[ALLOWED_ORIGINS.length - 1]
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const h = (status: number, data: Record<string, unknown>) =>
    new Response(JSON.stringify(data), { status, headers: headers(req) })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: headers(req) })
  if (req.method !== 'GET' && req.method !== 'POST') {
    return h(405, { is_manager: false, isManager: false, reason: 'method_not_allowed' })
  }

  // Always answer 200 with is_manager:false on auth problems (never 401):
  // the client fail-closes on transport errors but expects a JSON body.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return h(200, { is_manager: false, isManager: false, reason: 'invalid_token' })
  }

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !serviceRoleKey) {
    console.error('is-manager misconfigured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return h(200, { is_manager: false, isManager: false, reason: 'misconfigured' })
  }

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } })
  const { data, error } = await admin.auth.getUser(authHeader.slice(7))
  if (error || !data.user) {
    return h(200, { is_manager: false, isManager: false, reason: 'invalid_token' })
  }

  const email = (data.user.email ?? '').toLowerCase()
  if (!email) return h(200, { is_manager: false, isManager: false, reason: 'no_email' })
  if (!email.endsWith(`@${EG_EMAIL_DOMAIN}`)) {
    return h(200, { is_manager: false, isManager: false, reason: 'not_eg_domain', email })
  }

  return h(200, {
    is_manager: true,
    isManager: true,
    email,
    name: (data.user.user_metadata?.full_name as string | undefined) || '',
    avatar: (data.user.user_metadata?.avatar_url as string | undefined) || '',
  })
})

// Keep the shared helpers referenced so tree-shaking never drops them.
void corsHeaders
void json
void fail
