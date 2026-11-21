/**
 * supabase/functions/newsletter-get/index.ts
 * @why Single authoritative read of all newsletters.
 *  Returns every newsletter row so the client can render and reconcile via
 *  Realtime.
 *
 * GET /functions/v1/newsletter-get
 * Auth: Bearer <access token of an @earthguardians.org account>
 */
import { fail, json } from '../_shared/cors.ts'
import { requireManager } from '../_shared/auth.ts'

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })

  if (req.method !== 'GET') return fail('Method not allowed', 405, req)

  const { user, error } = await requireManager(req)
  if (error || !user) return fail(error || 'Forbidden', 403, req)

  const admin = await adminClient()
  if (!admin) return fail('Server is not configured', 500, req)

  const [newslettersRes] = await Promise.all([
    admin
      .from('newsletters')
      .select('id,title,subject,body,status,scheduled_at,sent_at,recipient_list,created_at,updated_at,updated_by')
      .order('created_at', { ascending: false }),
  ])

  if (newslettersRes.error) return fail(newslettersRes.error.message, 500, req)

  return json(
    {
      ok: true,
      newsletters: newslettersRes.data ?? [],
      server_time: new Date().toISOString(),
      served_by: user.email,
    },
    200,
    req,
  )
})

function cors(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': req.headers.get('origin') || 'https://guardioesdaterra.github.io',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

async function adminClient() {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !key) return null
  const { createClient } = await import('jsr:@supabase/supabase-js@2')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
