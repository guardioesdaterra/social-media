/** Allowed origins for the edge functions (CORS + manager gate). */
export const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8777',
  'https://guardioesdaterra.github.io',
  'https://earthguardians.org',
  'https://www.earthguardians.org',
  'https://app.earthguardians.org',
  'https://calendar.earthguardians.org',
  'https://eg-maps.grants.earthguardians.org',
]

/** Domain that grants manager access to the panel. */
export const MANAGER_DOMAIN = '@earthguardians.org'

/** Max size of one base64 image accepted by the server (4 MiB). */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

/** Max size of one base64 video accepted by the server (100 MiB). */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024

/** App name. */
export const APP_NAME = 'Social Media'

/** Panel subtitle. */
export const APP_TAGLINE = 'Editorial calendar · @earthguardians'
