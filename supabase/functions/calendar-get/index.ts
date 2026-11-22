/**
 * supabase/functions/calendar-get/index.ts
 * @why Single authoritative read of the whole editorial calendar.
 *  Returns topics (with the "needs attention" ranking), every post (including
 *  base64 images) and the settings, so the client can render immediately and
 *  then reconcile through Realtime.
 *
 * GET /functions/v1/calendar-get
 * Auth: Bearer <access token of an @earthguardians.org account>
 */
import { corsHeaders, fail, json } from '../_shared/cors.ts'
import { getVersion, requireManager } from '../_shared/auth.ts'

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })

  if (req.method !== 'GET') return fail('Method not allowed', 405, req)

  const { user, error } = await requireManager(req)
  if (error || !user) return fail(error || 'Forbidden', 403, req)

  const admin = await adminClient()
  if (!admin) return fail('Server is not configured', 500, req)

  const [topicsRes, postsRes, settingsRes] = await Promise.all([
    admin
      .from('calendar_topics')
      .select('key,label,description,color,emoji,sort,needs_attention,attention_rank,updated_at,updated_by')
      .order('sort', { ascending: true }),
    admin
      .from('calendar_posts')
      .select(
        'id,day,year,month,dow,topic_key,format,title,caption,hashtags,status,image_base64,image_mime,image_name,image_bytes,sort_order,created_at,updated_at,updated_by',
      )
      .order('day', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    admin
      .from('calendar_settings')
      .select('key,value,updated_at')
      .neq('key', 'version')
      .order('key', { ascending: true }),
  ])

  if (topicsRes.error) return fail(topicsRes.error.message, 500, req)
  if (postsRes.error) return fail(postsRes.error.message, 500, req)
  if (settingsRes.error) return fail(settingsRes.error.message, 500, req)

  const version = await getVersion(admin)

  return json(
    {
      ok: true,
      topics: topicsRes.data ?? [],
      posts: postsRes.data ?? [],
      settings: (settingsRes.data ?? []).map((s) => ({
        key: s.key,
        value: s.value,
        updated_at: s.updated_at,
      })),
      version,
      server_time: new Date().toISOString(),
      served_by: user.email,
    },
    200,
    req,
  )
})

async function adminClient() {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !key) return null
  const { createClient } = await import('jsr:@supabase/supabase-js@2')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
