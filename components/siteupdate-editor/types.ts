/**
 * Shared types for the site update editor sections.
 */

import type { SiteUpdateDraft } from '~/lib/types'

export interface SiteUpdateForm extends SiteUpdateDraft {
  published_at: string
}
