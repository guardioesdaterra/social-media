/**
 * supabase/functions/store-provider-token/index.ts
 *
 * POST /functions/v1/store-provider-token
 * Auth: Bearer <access_token>
 *
 * Called right after a successful Google OAuth sign-in (from the callback page).
 * Persists the Google provider_token and provider_refresh_token so the
 * tag-notify function can send emails via the Gmail API as the signed-in user.
 *
 * Body: { provider_token, provider_refresh_token, expires_in }
 *
 * The tokens are stored in manager_provider_tokens (service-role write,
 * RLS allows only the owner to read their own row).
 */
import { handleCors, json, fail, readJsonBody } from '../_shared/cors.ts'
import { requireManager, getAdminClient } from '../_shared/auth.ts'

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') return fail('Method not allowed', 405, req)

  const { user, error } = await requireManager(req)
  if (error || !user) return fail(error || 'Forbidden', 403, req)

  const body = await readJsonBody(req)
  if (!body) return fail('Invalid JSON body', 400, req)

  const providerToken = typeof body.provider_token === 'string' ? body.provider_token : null
  const providerRefreshToken =
    typeof body.provider_refresh_token === 'string' ? body.provider_refresh_token : null
  const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : 3600

  if (!providerToken && !providerRefreshToken) {
    return fail('No token provided', 400, req)
  }

  const admin = getAdminClient()
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  try {
    const { error: upsertErr } = await admin
      .from('manager_provider_tokens')
      .upsert(
        {
          user_id: user.id,
          email: user.email,
          provider_token: providerToken,
          provider_refresh_token: providerRefreshToken,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )

    if (upsertErr) throw upsertErr
    return json({ ok: true }, 200, req)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to store token'
    console.error('[store-provider-token]', message)
    return fail(message, 500, req)
  }
})
