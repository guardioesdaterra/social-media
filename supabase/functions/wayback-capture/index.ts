/**
 * supabase/functions/wayback-capture/index.ts
 * @why Trigger Wayback Machine Save Page Now capture via API.
 *  The API key is stored in server-side env vars, never exposed to client.
 *
 * POST /functions/v1/wayback-capture
 * Auth: Bearer <access token of an @earthguardians.org account>
 * Body: { url: "https://..." }
 */
import { fail, json, readJsonBody } from '../_shared/cors.ts'
import { requireManager, type AuthedUser } from '../_shared/auth.ts'

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return fail('Method not allowed', 405, req)

  const { user, error } = await requireManager(req)
  if (error || !user) return fail(error || 'Forbidden', 403, req)

  const body = await readJsonBody(req)
  if (!body) return fail('Invalid JSON body', 400, req)

  const url = typeof body.url === 'string' ? body.url.trim() : ''
  if (!url) return fail('Missing url', 400, req)

  try {
    const result = await triggerCapture(url)
    return json({ ok: true, ...result }, 200, req)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Capture failed'
    console.error('[wayback-capture]', message)
    return fail(message, 500, req)
  }
})

async function triggerCapture(url: string): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get('WAYBACK_API_KEY')
  if (!apiKey) {
    throw new Error('Wayback API key not configured')
  }

  // Use Save Page Now v2 API
  const saveUrl = `https://web.archive.org/save/${url}`
  
  const res = await fetch(saveUrl, {
    method: 'POST',
    headers: {
      'Authorization': `LOW ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      url,
      // Skip if captured in last 7 days
      'if_not_archived_within': '7',
      // Capture 4xx/5xx pages too
      'capture_all': '1',
    }),
  })

  if (!res.ok) {
    const status = res.status
    const text = await res.text()
    throw new Error(`Wayback API error: ${status} - ${text.slice(0, 200)}`)
  }

  // Parse the response to get the new snapshot URL
  const contentType = res.headers.get('content-type') || ''
  
  if (contentType.includes('application/json')) {
    const data = await res.json()
    return {
      message: 'Capture queued',
      url: data.url || `https://web.archive.org/web/2/${url}`,
      job_id: data.job_id || null,
    }
  }

  // HTML response means capture started, redirect to the snapshot
  return {
    message: 'Capture started',
    url: `https://web.archive.org/web/2/${url}`,
  }
}

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || ''
  return {
    'Access-Control-Allow-Origin': origin || 'https://guardioesdaterra.github.io',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}