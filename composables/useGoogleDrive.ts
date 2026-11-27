/**
 * Google Drive integration composable.
 * Uses the user's Google provider_token (access_token) from Supabase session
 * to list files/folders and download media for the editorial calendar.
 */

import { useSupabaseAuth } from '~/composables/useSupabaseAuth'
import { edgeFunctionUrl } from '~/lib/supabase'
import { isMock } from '~/lib/mock'
import { ref, computed } from 'vue'

const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3'

/**
 * Thrown when no Google access token can be obtained. The picker renders the
 * "Connect Google Drive" screen for this instead of a generic error.
 */
export class GoogleNotConnectedError extends Error {
  constructor(message = 'Google Drive isn’t connected.') {
    super(message)
    this.name = 'GoogleNotConnected'
  }
}

// ——— access-token cache ————————————————————————————————————————————————
//
// Google emits `session.provider_token` exactly once (right after the OAuth
// redirect) and Supabase drops it from the persisted session on the first
// token refresh. We therefore cache the token ourselves (memory + localStorage)
// and fall back to the `google-token` edge function, which serves the stored
// token or refreshes it with the stored provider_refresh_token.

const TOKEN_STORAGE_KEY = 'eg:google-access-token'
/** Google access tokens live 1 hour; we refresh our copy a minute early. */
const TOKEN_TTL_MS = 3_600_000
const TOKEN_SKEW_MS = 60_000

interface CachedToken {
  token: string
  expiresAt: number
}

let cachedToken: CachedToken | null = null
let tokenRequest: Promise<string | null> | null = null

function isFresh(token: CachedToken | null): token is CachedToken {
  return !!token && typeof token.expiresAt === 'number' && token.expiresAt - TOKEN_SKEW_MS > Date.now()
}

function readTokenCache(): CachedToken | null {
  if (isFresh(cachedToken)) return cachedToken
  if (import.meta.client) {
    try {
      const raw = localStorage.getItem(TOKEN_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as CachedToken
        if (parsed && typeof parsed.token === 'string' && typeof parsed.expiresAt === 'number') {
          cachedToken = parsed
        }
      }
    } catch {
      // storage unavailable (private mode / SSR) — memory cache still works
    }
  }
  return isFresh(cachedToken) ? cachedToken : null
}

function writeTokenCache(token: string, expiresAt: number): void {
  cachedToken = { token, expiresAt }
  if (import.meta.client) {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(cachedToken))
    } catch {
      // ignore
    }
  }
}

function clearTokenCache(): void {
  cachedToken = null
  if (import.meta.client) {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
    } catch {
      // ignore
    }
  }
}

/** Drop any locally cached Google token so the next call starts fully fresh. */
export function clearConnection(): void {
  clearTokenCache()
  tokenRequest = null
}

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size?: string
  parents?: string[]
  modifiedTime: string
  thumbnailLink?: string
  webViewLink?: string
  iconLink?: string
}

interface DriveListResponse {
  files: DriveFile[]
  nextPageToken?: string
  incompleteSearch?: boolean
}

export interface MediaFile {
  id: string
  name: string
  mimeType: string
  size: number
  dataUrl: string
  kind: 'image' | 'video'
  thumbnailUrl?: string
}

const WORKSPACE_MIME_TYPES = new Set([
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
  'application/vnd.google-apps.drawing',
  'application/vnd.google-apps.form',
  'application/vnd.google-apps.script',
  'application/vnd.google-apps.site',
  'application/vnd.google-apps.folder',
  'application/vnd.google-apps.map',
  'application/vnd.google-apps.fusiontable',
  'application/vnd.google-apps.photo',
])

function isDownloadableMedia(mimeType: string): boolean {
  return mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType.startsWith('audio/')
}

function isWorkspaceFile(mimeType: string): boolean {
  return WORKSPACE_MIME_TYPES.has(mimeType)
}

export function useGoogleDrive() {
  const { session } = useSupabaseAuth()
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isSignedIn = computed(() => !!session.value)

  /**
   * Picks up `provider_token` from the Supabase session when it is there —
   * only happens once, straight after the OAuth redirect — and caches it with
   * a 1-hour lifetime so later refreshes of the Supabase session can't lose it.
   */
  function captureSessionToken(): void {
    const s = session.value as unknown as
      | { provider_token?: string | null; user?: { identities?: unknown[] } }
      | null
    if (!s) return
    const identityToken = ((s.user?.identities ?? []) as Array<{ provider?: string; identity_data?: { provider_token?: string } }>)
      .find((i) => i.provider === 'google')
      ?.identity_data?.provider_token
    const token = s.provider_token || identityToken || null
    if (token && cachedToken?.token !== token) {
      writeTokenCache(token, Date.now() + TOKEN_TTL_MS)
    }
  }

  /** Synchronous local token, if it is still valid. */
  function getLocalToken(): string | null {
    captureSessionToken()
    return readTokenCache()?.token ?? null
  }

  /**
   * Returns a usable Google access token, hitting the `google-token` edge
   * function (stored token → Google refresh) when the local cache is empty or
   * stale. Returns `null` when Google isn't connected; throws on server errors.
   */
  async function ensureAccessToken(options: { force?: boolean } = {}): Promise<string | null> {
    if (!session.value) return null
    // Mock mode has no Supabase (and therefore no Drive): fall through to the
    // "Connect Google Drive" screen instead of a pointless network call.
    if (isMock()) return null
    if (!options.force) {
      const local = getLocalToken()
      if (local) return local
    }
    if (tokenRequest) return tokenRequest

    tokenRequest = (async () => {
      const supabaseToken = session.value?.access_token
      if (!supabaseToken) return null
      try {
        const res = await fetch(edgeFunctionUrl('google-token'), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${supabaseToken}`,
            'x-client-info': 'eg-social-media/1.0',
          },
        })

        if (res.status === 401) {
          clearTokenCache()
          return null
        }

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error || `Could not reach Google Drive (HTTP ${res.status}).`)
        }

        const data = (await res.json()) as { access_token?: string; expires_at?: number }
        if (!data.access_token) return null

        writeTokenCache(data.access_token, data.expires_at || Date.now() + TOKEN_TTL_MS)
        return data.access_token
      } catch (err) {
        // Distinguish "offline / edge function unreachable" (retryable) from a
        // genuine "Google is not connected" (401, handled above).
        if (err instanceof TypeError) {
          throw new Error('Could not reach Google Drive. Check your connection and try again.', {
            cause: err,
          })
        }
        throw err
      } finally {
        tokenRequest = null
      }
    })()

    return tokenRequest
  }

  async function apiFetch<T>(path: string, options: RequestInit = {}, allowRetry = true): Promise<T> {
    const token = await ensureAccessToken()
    if (!token) throw new GoogleNotConnectedError()

    const res = await fetch(`${GOOGLE_DRIVE_API}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (res.status === 401) {
      // The token expired mid-flight: drop it, ask the server for a fresh one
      // (or a prompt to reconnect) and try exactly once more.
      clearTokenCache()
      if (allowRetry) return apiFetch<T>(path, options, false)
      throw new GoogleNotConnectedError('Google Drive access expired. Reconnect Google Drive to continue.')
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error?.message || `Google Drive API error: ${res.status}`)
    }

    return res.json() as Promise<T>
  }

  async function listFiles(folderId: string = 'root', pageToken?: string): Promise<DriveListResponse> {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id,name,mimeType,size,parents,modifiedTime,thumbnailLink,webViewLink,iconLink),nextPageToken,incompleteSearch',
      pageSize: '100',
      orderBy: 'folder,name',
    })
    if (pageToken) params.set('pageToken', pageToken)

    return apiFetch<DriveListResponse>(`/files?${params.toString()}`)
  }

  async function getFile(fileId: string): Promise<DriveFile> {
    const params = new URLSearchParams({
      fields: 'id,name,mimeType,size,parents,modifiedTime,thumbnailLink,webViewLink,iconLink',
    })
    return apiFetch<DriveFile>(`/files/${fileId}?${params.toString()}`)
  }

  /** Base64-encode an ArrayBuffer without spreading the whole buffer into
   *  function arguments (which throws "Maximum call stack size exceeded" for
   *  multi-megabyte images/videos). Encodes in small chunks instead. */
  function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    const CHUNK = 8192
    const parts: string[] = []
    for (let i = 0; i < bytes.length; i += CHUNK) {
      parts.push(String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK))))
    }
    return btoa(parts.join(''))
  }

  async function downloadFile(
    fileId: string,
    mimeType: string,
    signal?: AbortSignal,
    allowRetry = true,
  ): Promise<string> {
    const token = await ensureAccessToken()
    if (!token) throw new GoogleNotConnectedError()

    const res = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}?alt=media`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal,
    })

    if (res.status === 401) {
      clearTokenCache()
      if (allowRetry) return downloadFile(fileId, mimeType, signal, false)
      throw new GoogleNotConnectedError('Google Drive access expired. Reconnect Google Drive to continue.')
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error?.message || `Download failed: ${res.status}`)
    }

    const arrayBuffer = await res.arrayBuffer()
    return `data:${mimeType};base64,${arrayBufferToBase64(arrayBuffer)}`
  }

  async function fetchFolderMedia(
    folderId: string,
    onProgress?: (current: number, total: number | null) => void,
    options?: { signal?: AbortSignal },
  ): Promise<MediaFile[]> {
    loading.value = true
    error.value = null
    const results: MediaFile[] = []
    let totalFiles = 0

    async function processFolder(currentFolderId: string): Promise<void> {
      let pageToken: string | undefined
      do {
        const response = await listFiles(currentFolderId, pageToken)
        pageToken = response.nextPageToken

        for (const file of response.files) {
          options?.signal?.throwIfAborted()
          const isFolder = file.mimeType === 'application/vnd.google-apps.folder'
          const isDownloadable = isDownloadableMedia(file.mimeType)
          const isWorkspace = isWorkspaceFile(file.mimeType)

          if (isFolder) {
            await processFolder(file.id)
          } else if (isDownloadable) {
            totalFiles++
            onProgress?.(results.length + 1, totalFiles || null)
            try {
              const dataUrl = await downloadFile(file.id, file.mimeType, options?.signal)
              results.push({
                id: file.id,
                name: file.name,
                mimeType: file.mimeType,
                size: parseInt(file.size || '0', 10),
                dataUrl,
                kind: file.mimeType.startsWith('video/') ? 'video' : 'image',
                thumbnailUrl: file.thumbnailLink,
              })
              onProgress?.(results.length, totalFiles)
            } catch (err) {
              console.warn(`Failed to download ${file.name}:`, err)
            }
          } else if (isWorkspace) {
            console.debug(`Skipping Google Workspace file: ${file.name} (${file.mimeType})`)
          }
        }
      } while (pageToken)
    }

    try {
      await processFolder(folderId)
      return results
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch folder media'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function downloadFiles(fileIds: string[], options?: { signal?: AbortSignal }): Promise<MediaFile[]> {
    loading.value = true
    error.value = null
    const results: MediaFile[] = []

    try {
      for (const fileId of fileIds) {
        options?.signal?.throwIfAborted()
        const file = await getFile(fileId)
        const isDownloadable = isDownloadableMedia(file.mimeType)
        if (!isDownloadable) {
          console.debug(`Skipping non-media file: ${file.name} (${file.mimeType})`)
          continue
        }

        const dataUrl = await downloadFile(fileId, file.mimeType, options?.signal)
        results.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: parseInt(file.size || '0', 10),
          dataUrl,
          kind: file.mimeType.startsWith('video/') ? 'video' : 'image',
          thumbnailUrl: file.thumbnailLink,
        })
      }
      return results
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to download files'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function searchFiles(query: string): Promise<DriveFile[]> {
    const escapedQuery = query.replace(/'/g, "\\'")
    const params = new URLSearchParams({
      q: `name contains '${escapedQuery}' and trashed = false`,
      fields: 'files(id,name,mimeType,size,parents,modifiedTime,thumbnailLink,webViewLink,iconLink)',
      pageSize: '50',
    })
    const response = await apiFetch<DriveListResponse>(`/files?${params.toString()}`)
    return response.files
  }

  /**
   * True when a locally cached Google token is valid right now. The session
   * being present is exposed separately as `isSignedIn` — together they tell
   * the picker whether it can browse immediately or must connect Google first.
   */
  const hasToken = computed(() => !!getLocalToken())

  return {
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    hasToken,
    isSignedIn,
    ensureAccessToken,
    listFiles,
    getFile,
    downloadFile,
    fetchFolderMedia,
    downloadFiles,
    searchFiles,
    getAccessToken: getLocalToken,
    clearConnection,
    isDownloadableMedia,
    isWorkspaceFile,
  }
}
