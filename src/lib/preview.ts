import { createMiddleware } from '@tanstack/react-start'
import { readPreviewToken } from 'fontdue-js/preview'
import { runWithPreview } from 'fontdue-js/preview/server'

// Global request middleware — runs once per HTTP request, wrapping every route
// loader and server route. It has two responsibilities, both per request:
//
// 1. Preview. runWithPreview puts the logged-in admin's token (from the preview
//    cookie set by /api/preview) into an ambient AsyncLocalStorage context for
//    the whole render, so every GraphQL fetch and fontdue-js preload reveals
//    unpublished ("hidden") fonts with no per-loader plumbing — and it forces
//    preview responses out of the shared CDN cache so an admin render is never
//    served to the public. This relies on the middleware running in the same
//    runtime as the render, which is the case for the Netlify Functions SSR
//    target (Node). If you move to a split edge runtime where the context can't
//    cross to the render, fall back to reading the token here and threading
//    previewAuthHeaders(token) into fetches/preloads explicitly.
//
// 2. CDN caching for public pages. Netlify's edge serves the cached HTML
//    instantly while regenerating in the background, so the page feels static
//    (sub-100ms TTFB) without prerendering. Browsers always revalidate
//    (`max-age=0`) so users see whatever the edge currently holds. Tag every
//    page with `fontdue` so /api/revalidate can purge them all at once when
//    Fontdue data changes. Preview and non-HTML/API responses are left
//    uncacheable (runWithPreview already marked preview responses no-store).
//
// Registered via createStart({ requestMiddleware: [...] }) in src/start.ts.
export const previewMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ request, next }) => {
    const previewing = readPreviewToken(request.headers.get('cookie')) != null

    // runWithPreview runs `next` inside the ambient preview context, then
    // returns the rendered Response (rewriting it to no-store when previewing).
    const response = await runWithPreview(
      request,
      async () => (await next()).response,
    )

    const url = new URL(request.url)
    const isHtml = response.headers
      .get('content-type')
      ?.includes('text/html')

    // Only public, non-preview HTML gets the long-lived CDN cache. Preview
    // responses were already marked uncacheable by runWithPreview.
    if (
      !previewing &&
      response.status === 200 &&
      isHtml &&
      !url.pathname.startsWith('/api/')
    ) {
      response.headers.set(
        'Netlify-CDN-Cache-Control',
        'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
      )
      response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
      response.headers.set('Netlify-Cache-Tag', 'fontdue')
    }

    return response
  },
)
