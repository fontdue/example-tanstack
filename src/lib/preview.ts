import { createMiddleware } from '@tanstack/react-start'
import { readPreviewToken } from 'fontdue-js/preview'
import { runWithFontdue } from 'fontdue-js/server/middleware'

// Global request middleware — runs once per HTTP request, wrapping every route
// loader and server route. It has two responsibilities, both per request:
//
// 1. Fontdue request context. runWithFontdue puts two request-scoped tokens into
//    an ambient AsyncLocalStorage context for the whole render: the admin preview
//    token (from the cookie set by /api/preview — reveals unpublished "hidden"
//    fonts) and the visitor's per-collection node-access token (a collection they
//    unlocked with a password). Every GraphQL fetch and fontdue-js preload
//    forwards them with no per-loader plumbing — and it forces a per-visitor
//    response out of the shared CDN cache so an admin's (or an unlocked
//    visitor's) render is never served to the public. (runWithFontdue is
//    runWithPreview composed with runWithNodeAccess; mount either alone for one.)
//    This relies on the middleware running in the same runtime as the render,
//    which is the case for the Netlify Functions SSR target (Node). If you move
//    to a split edge runtime where the context can't cross to the render, fall
//    back to reading the cookies here and threading previewAuthHeaders(token) /
//    nodeAccessHeadersFromCookie(cookie) into fetches/preloads explicitly.
//
// 2. CDN caching for public pages. Netlify's edge serves the cached HTML
//    instantly while regenerating in the background, so the page feels static
//    (sub-100ms TTFB) without prerendering. Browsers always revalidate
//    (`max-age=0`) so users see whatever the edge currently holds. Tag every
//    page with `fontdue` so /api/revalidate can purge them all at once when
//    Fontdue data changes. Per-visitor and non-HTML/API responses are left
//    uncacheable (runWithFontdue already marked per-visitor responses no-store).
//
// Registered via createStart({ requestMiddleware: [...] }) in src/start.ts.
export const previewMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ request, next }) => {
    const previewing = readPreviewToken(request.headers.get('cookie')) != null

    // runWithFontdue runs `next` inside the ambient context, then returns the
    // rendered Response (rewriting it to no-store for a per-visitor render).
    const response = await runWithFontdue(
      request,
      async () => (await next()).response,
    )

    const url = new URL(request.url)
    const isHtml = response.headers
      .get('content-type')
      ?.includes('text/html')

    // Only public HTML gets the long-lived CDN cache. runWithFontdue already
    // marked per-visitor responses (admin preview, or a collection this visitor
    // unlocked via the node-access cookie) `no-store`; don't override that, or an
    // unlocked render could be cached and served to someone who hasn't unlocked.
    const uncacheable = response.headers
      .get('cache-control')
      ?.includes('no-store')
    if (
      !previewing &&
      !uncacheable &&
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
