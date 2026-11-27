/**
 * Shared types for the newsletter editor sections.
 */

import type { NewsletterDraft } from '~/lib/types'

export interface NewsletterForm extends NewsletterDraft {
  scheduled_at: string
}
