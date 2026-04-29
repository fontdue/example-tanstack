import { createFileRoute } from '@tanstack/react-router'
import { purgeCache } from '@netlify/functions'

// POST /api/revalidate?token=… — invalidate cached HTML so the next
// request regenerates against fresh Fontdue data. Authenticated with a
// shared secret in REVALIDATE_TOKEN. Wire the URL into the Fontdue
// Website settings → Deploy hook URL field.
//
// The Fontdue API does not currently include a collection id/slug in
// its change notifications, so this purges every page tagged `fontdue`
// (set in __root.tsx via setResponseHeaders) in one call. If
// per-collection tags become available later, switch the tag to
// `fontdue:${slug}` in fonts.$slug.tsx and pass the matching tag here.
//
// `Cache-Control: no-store` on the response object opts this endpoint
// out of the root-level CDN cache headers — Netlify won't cache the
// purge response itself.
export const Route = createFileRoute('/api/revalidate')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.REVALIDATE_TOKEN
        if (!expected) {
          return new Response('REVALIDATE_TOKEN not configured', {
            status: 500,
            headers: { 'Cache-Control': 'no-store' },
          })
        }

        const provided = new URL(request.url).searchParams.get('token')
        if (provided !== expected) {
          return new Response('Unauthorized', {
            status: 401,
            headers: { 'Cache-Control': 'no-store' },
          })
        }

        await purgeCache({ tags: ['fontdue'] })

        return new Response(JSON.stringify({ purged: ['fontdue'] }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'Cache-Control': 'no-store',
          },
        })
      },
    },
  },
})
