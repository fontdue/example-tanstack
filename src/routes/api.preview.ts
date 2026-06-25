import { createFileRoute } from '@tanstack/react-router'
import { handlePreviewRequest } from 'fontdue-js/preview'

// Preview enter/exit. The Fontdue admin toolbar — shown only to logged-in
// admins by <FontdueProvider> — POSTs a short-lived token here to turn preview
// on, and DELETEs to turn it off. handlePreviewRequest sets the preview cookies
// (an httpOnly token + a readable marker that the toolbar checks); the global
// request middleware (src/start.ts) wraps each request in runWithFontdue, which
// forwards the token to GraphQL and keeps preview pages out of the shared CDN
// cache so the public never sees unpublished fonts.
//
// The default path the toolbar targets is /api/preview — to use another, set
// config.preview.endpoint on <FontdueProvider> and rename this route to match.
export const Route = createFileRoute('/api/preview')({
  server: {
    handlers: {
      POST: ({ request }) => handlePreviewRequest(request),
      DELETE: ({ request }) => handlePreviewRequest(request),
    },
  },
})
