/**
 * Google Drive integration composable.
 * Uses the user's Google provider_token (access_token) from Supabase session
 * to list files/folders and download media for the editorial calendar.
 */

import { useSupabaseAuth } from '~/composables/useSupabaseAuth'
import { ref, computed } from 'vue'

const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3'

interface DriveFile {
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

export interface DriveFilePublic {
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
  files: DriveFilePublic[]
  nextPageToken?: string
  incompleteSearch?: boolean
}

interface MediaFile {
  id: string
  name: string
  mimeType: string
  size: number
  dataUrl: string
  kind: 'image' | 'video'
  thumbnailUrl?: string
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

  async function getFile(fileId: string): Promise<DriveFilePublic> {
    const params = new URLSearchParams({
      fields: 'id,name,mimeType,size,parents,modifiedTime,thumbnailLink,webViewLink,iconLink',
    })
    return apiFetch<DriveFilePublic>(`/files/${fileId}?${params.toString()}`)
  }

  async function downloadFile(fileId: string, mimeType: string): Promise<string> {
    const token = getAccessToken()
    if (!token) throw new Error('No Google access token available.')

    const res = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}?alt=media`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error?.message || `Download failed: ${res.status}`)
    }

    const arrayBuffer = await res.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
    return `data:${mimeType};base64,${base64}`
  }

  async function fetchFolderMedia(folderId: string, onProgress?: (current: number, total: number) => void): Promise<MediaFile[]> {
    loading.value = true
    error.value = null
    const results: MediaFile[] = []

    async function processFolder(currentFolderId: string): Promise<void> {
      let pageToken: string | undefined
      do {
        const response = await listFiles(currentFolderId, pageToken)
        pageToken = response.nextPageToken

        for (const file of response.files) {
          const isFolder = file.mimeType === 'application/vnd.google-apps.folder'
          const isImage = file.mimeType.startsWith('image/')
          const isVideo = file.mimeType.startsWith('video/')

          if (isFolder) {
            await processFolder(file.id)
          } else if (isImage || isVideo) {
            try {
              const dataUrl = await downloadFile(file.id, file.mimeType)
              results.push({
                id: file.id,
                name: file.name,
                mimeType: file.mimeType,
                size: parseInt(file.size || '0', 10),
                dataUrl,
                kind: isVideo ? 'video' : 'image',
                thumbnailUrl: file.thumbnailLink,
              })
              onProgress?.(results.length, results.length)
            } catch (err) {
              console.warn(`Failed to download ${file.name}:`, err)
            }
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
        const isImage = file.mimeType.startsWith('image/')
        const isVideo = file.mimeType.startsWith('video/')
        if (!isImage && !isVideo) continue

        const dataUrl = await downloadFile(fileId, file.mimeType)
        results.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: parseInt(file.size || '0', 10),
          dataUrl,
          kind: isVideo ? 'video' : 'image',
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

  async function searchFiles(query: string): Promise<DriveFilePublic[]> {
    const params = new URLSearchParams({
      q: `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`,
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
  }
}
