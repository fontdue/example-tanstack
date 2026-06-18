import { createFontdueFetch, FontdueNotFoundError } from 'fontdue-js/server'

// A single server-side GraphQL fetcher for the whole app. It resolves the
// Fontdue URL from the environment (VITE_FONTDUE_URL / PUBLIC_FONTDUE_URL /
// FONTDUE_URL) and handles the POST, error handling, and `data` unwrapping, so
// there's no transport boilerplate in the route loaders.
//
// There's no per-request binding: because the global request middleware (see
// src/start.ts) wraps every request in runWithPreview, this fetcher
// automatically forwards the admin preview token when an admin is previewing
// (revealing unpublished fonts), and sends a plain request otherwise. The same
// is true of every fontdue-js preload helper (loadTypeTesterQuery,
// loadFontdueProviderQuery, …) — call them with just their variables and they
// pick up preview from the ambient context.
//
// Use it at the top of a loader:
//
//   loader: async () => {
//     const data = await fetchGraphql<IndexQuery>('Index', IndexDoc)
//   }
export const fetchGraphql = createFontdueFetch()

// Thrown by the fetcher when Fontdue 404s the request (the host doesn't resolve
// to a site). Catch it in a loader to surface a not-found response.
export { FontdueNotFoundError }
