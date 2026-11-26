/**
 * Google Drive integration composable.
 * Uses the user's Google provider_token (access_token) from Supabase session
 * to list files/folders and download media for the editorial calendar.
 */

import { useSupabaseAuth } from '~/composables/useSupabaseAuth'
import { ref, computed } from 'vue'

const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3'

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

  function getAccessToken(): string | null {
    if (!session.value) return null
    const identities = (session.value.user as any)?.identities
    if (identities?.length > 0) {
      const googleIdentity = identities.find((i: any) => i.provider === 'google')
      if (googleIdentity?.identity_data?.provider_token) {
        return googleIdentity.identity_data.provider_token
      }
    }
    return (session.value as any).provider_token || null
  }

  async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = getAccessToken()
    if (!token) throw new Error('No Google access token available. Please sign in again.')

    const res = await fetch(`${GOOGLE_DRIVE_API}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (res.status === 401) {
      throw new Error('Google access token expired. Please sign in again.')
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

  async function downloadFile(fileId: string, mimeType: string): Promise<string> {
    const token = getAccessToken()
    if (!token) throw new Error('No Google access token available.')

    const res = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}?alt=media`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })

    if (res.status === 401) {
      throw new Error('Google access token expired. Please sign in again.')
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error?.message || `Download failed: ${res.status}`)
    }

    const arrayBuffer = await res.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
    return `data:${mimeType};base64,${base64}`
  }

  async function fetchFolderMedia(
    folderId: string,
    onProgress?: (current: number, total: number | null) => void,
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
          const isFolder = file.mimeType === 'application/vnd.google-apps.folder'
          const isDownloadable = isDownloadableMedia(file.mimeType)
          const isWorkspace = isWorkspaceFile(file.mimeType)

          if (isFolder) {
            await processFolder(file.id)
          } else if (isDownloadable) {
            totalFiles++
            onProgress?.(results.length + 1, totalFiles || null)
            try {
              const dataUrl = await downloadFile(file.id, file.mimeType)
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

  async function downloadFiles(fileIds: string[]): Promise<MediaFile[]> {
    loading.value = true
    error.value = null
    const results: MediaFile[] = []

    try {
      for (const fileId of fileIds) {
        const file = await getFile(fileId)
        const isDownloadable = isDownloadableMedia(file.mimeType)
        if (!isDownloadable) {
          console.debug(`Skipping non-media file: ${file.name} (${file.mimeType})`)
          continue
        }

        const dataUrl = await downloadFile(fileId, file.mimeType)
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

  const hasToken = computed(() => !!getAccessToken())

  return {
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    hasToken,
    listFiles,
    getFile,
    downloadFile,
    fetchFolderMedia,
    downloadFiles,
    searchFiles,
    getAccessToken,
    isDownloadableMedia,
    isWorkspaceFile,
  }
}
