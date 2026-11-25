# Popup-Based OAuth for SquareSpace Embedding

## Overview

This app supports embedding into SquareSpace sites using a popup-based OAuth flow to work around Google's `X-Frame-Options: DENY` restriction that prevents OAuth login inside iframes.

## Architecture

### Two OAuth Modes

1. **Direct Redirect Mode** (default)
   - Used when app is accessed directly (not embedded)
   - Standard OAuth redirect flow
   - Google opens login page in same window

2. **Popup Mode** (for embedded contexts)
   - Used when app detects it's inside an iframe (SquareSpace)
   - Opens a popup window for OAuth
   - Session is relayed back to opener via `postMessage`
   - Popup closes after successful auth

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    SquareSpace Site                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Your Embed Container                       │   │
│  │  ┌───────────────────────────────────────────────────┐  │   │
│  │  │  App (embedded in iframe)                         │  │   │
│  │  │  1. User clicks "Sign in with Google"            │  │   │
│  │  │  2. usePopupAuth opens popup                     │  │   │
│  │  │  3. Popup opens Google OAuth                     │  │   │
│  │  │  4. User authenticates                           │  │   │
│  │  │  5. Google redirects to /auth/callback?popup=1   │  │   │
│  │  │  6. Callback stores session                      │  │   │
│  │  │  7. Callback posts message to opener             │  │   │
│  │  │  8. Opener receives session, popup closes        │  │   │
│  │  │  9. Opener redirects to /calendario              │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### usePopupAuth Composable

**Location:** `composables/usePopupAuth.ts`

Handles the popup authentication flow:

```typescript
const { signInWithPopup, isBusy, authResult } = usePopupAuth()

// Open popup and wait for auth
const result = await signInWithPopup()

if (result.success) {
  // Auth successful, session available
  console.log(result.session)
} else {
  // Handle error
  console.error(result.error)
}
```

**Features:**
- Opens centered popup window
- Listens for `postMessage` relay from callback
- Auto-closes popup after successful auth
- Handles timeout and popup closure
- Origin validation for security

### Auth Callback with Popup Support

**Location:** `pages/auth/callback.vue`

Modified to handle `?popup=1` parameter:

```typescript
// Check if this is a popup relay flow
const isPopupRelay = computed(() => {
  const params = new URLSearchParams(window.location.search)
  return params.has('popup')
})

// Relay session back to opener popup and close
async function relaySessionToOpener(session) {
  if (!window.opener) return
  
  window.opener.postMessage(
    {
      source: 'eg-auth',
      type: 'auth:session',
      payload: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      },
    },
    window.location.origin,
  )
}

async function closePopup() {
  await new Promise((resolve) => setTimeout(resolve, 200))
  if (window.opener && !window.opener.closed) {
    window.close()
  }
}
```

### LoginScreen Updates

**Location:** `components/LoginScreen.vue`

Auto-detects embedding context and chooses appropriate auth mode:

```typescript
// Detect if we're embedded in an iframe
const isEmbedded = computed(() => {
  try {
    return window.self !== window.top
  } catch {
    return true // Cross-origin iframe access -> embedded
  }
})

async function onSignIn() {
  if (isEmbedded) {
    // Use popup mode for embedded contexts
    const result = await signInWithPopup()
    // Handle result
  } else {
    // Use redirect mode for direct access
    const err = await signInWithGoogle()
    // Handle error
  }
}
```

### AuthGate Updates

**Location:** `components/AuthGate.vue`

Also supports popup flow for "Use another account":

```typescript
const isEmbedded = computed(() => {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
})

async function switchAccount() {
  if (isEmbedded) {
    // Use popup
    const result = await signInWithPopup()
    // Handle result
  } else {
    // Use redirect
    const err = await signInWithGoogle()
    // Handle error
  }
}
```

## PostMessage Protocol

### Session Relay Message

```typescript
{
  source: 'eg-auth',
  type: 'auth:session',
  payload: {
    access_token: string,
    refresh_token: string
  }
}
```

### Origin Validation

Only trusted origins are allowed to receive auth messages:

```typescript
const DEFAULT_TRUSTED_ORIGINS = [
  'https://earthguardians.org',
  'https://www.earthguardians.org'
]
```

## Integration with SquareSpace

### Embed Code Example

```html
<!-- 1. Add container -->
<div data-eg-map="active-crews" style="min-height:480px"></div>

<!-- 2. Load the widget script -->
<script src="https://YOUR-DOMAIN/eg-widget.js" defer></script>
```

### Auto-Detection

The app automatically detects when embedded:

```javascript
// In LoginScreen.vue
const isEmbedded = computed(() => {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
})
```

## Security

1. **Origin Validation**: Only trusted origins can receive auth messages
2. **PostMessage Validation**: Message source must match popup window
3. **Session Relay**: Only access/refresh tokens are relayed, not secrets
4. **Popup Closure**: Popup automatically closes after successful auth

## Testing

### Test Popup Mode

1. Embed the app in an iframe (Simulate SquareSpace)
2. Click "Sign in with Google"
3. Popup should open
4. After authentication, popup should close
5. Parent page should redirect to `/calendario`

### Test Direct Mode

1. Access the app directly (not embedded)
2. Click "Sign in with Google"
3. Should redirect to Google OAuth in same window
4. After authentication, redirect to `/calendario`

## Troubleshooting

### Popup Blocked

**Issue:** Browser blocks popup window

**Solution:** 
- Instruct users to allow popups for your domain
- Consider showing a modal with instructions

### Session Not Relay

**Issue:** Popup closes but parent doesn't receive session

**Solution:**
- Check browser console for postMessage errors
- Verify origin matches trusted origins
- Ensure popup and parent share same origin

### OAuth Flow Not Starting

**Issue:** Popup opens but Google OAuth doesn't load

**Solution:**
- Check URL has `?popup=1` parameter
- Verify callback URL is correctly configured in Supabase
- Check for JavaScript errors in popup

## Comparison with EG-Maps

### EG-Maps Approach

EG-Maps uses a more complex system with:
- `useSquarespaceEmbed` for host communication
- `useHostEmbed` for embedded state detection
- Multiple integration tiers (iframe, inline, widget, component)
- Advanced postMessage protocol

### Social-Media Approach

Social-Media uses a simpler, focused approach:
- `usePopupAuth` specifically for OAuth in embedded contexts
- Auto-detection of embedding context
- Session relay via postMessage
- Same callback handles both redirect and popup flows

### When to Use Each

**Use Social-Media Popup Auth When:**
- Simple OAuth embedding is needed
- Single-page app with one auth flow
- Minimal integration overhead

**Use EG-Maps When:**
- Complex map/embedding system
- Multiple integration modes needed
- Advanced host-embed communication
- Custom element support required

## Future Improvements

1. Add loading state to show "Authentication in progress"
2. Support additional OAuth providers
3. Add session refresh in popup
4. Support web component embedding
5. Add analytics for embedded auth success rates
