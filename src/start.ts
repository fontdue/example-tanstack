import { createStart } from '@tanstack/react-start'

import { previewMiddleware } from './lib/preview'

// Global TanStack Start instance. `requestMiddleware` runs once per HTTP
// request, around every route loader and server route — the framework-level
// equivalent of Astro's src/middleware.ts or an RR7 root-route middleware.
//
// previewMiddleware wraps each request in fontdue-js's runWithFontdue (ambient
// admin preview token + a visitor's collection-unlock token) and applies the
// public CDN cache headers. The Start plugin auto-discovers this file
// (src/start.ts, exporting `startInstance`); no import or registration elsewhere
// is needed.
export const startInstance = createStart(() => ({
  requestMiddleware: [previewMiddleware],
}))
