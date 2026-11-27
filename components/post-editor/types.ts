/**
 * Shared types for the post editor sections.
 */

import type { PostFormat, PostStatus } from '~/lib/types'

export interface PostForm {
  id: string
  day: string
  scheduled_at: string | null
  topic_key: string
  format: PostFormat
  status: PostStatus
  title: string
  caption: string
  hashtags: string
  image_base64: string | null
  video_base64: string | null
}

export interface MediaState {
  preview: string | null
  kind: 'image' | 'video' | null
  bytes: number
  name: string
  origin: 'local' | 'gdrive' | null
}

export type MediaSource = 'local' | 'gdrive'
