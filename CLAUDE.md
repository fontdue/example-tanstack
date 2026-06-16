# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A demo/integration POC showing how to consume `fontdue-js@3.x` (alpha) — the
framework-agnostic preload + preview API — from a **TanStack Start** SSR app.
The same preload pattern applies to any React-rendering SSR framework. Pin a
specific `fontdue-js` alpha version exactly (no caret/tilde — alpha versions
without a dot break npm range matching); the 3.x surface is unstable until
3.0.0 ships.

Sibling POCs validating the same API on other frameworks (useful for
cross-checking patterns):
- `~/code/fontdue/fontdue-rr7-example` — React Router 7 (root-route middleware).
- `~/code/fontdue/fontdue-astro-example` — Astro (`src/middleware.ts`).
- `~/code/fontdue/fontdue-example-next` — Next.js 15 App Router (RSC magic path).

## Commands

- `cp .env.example .env` (required before first run; sets `VITE_FONTDUE_URL`)
- `npm install`
- `npm run dev` — runs `vite dev --port 3000` and `graphql-codegen --watch` in
  parallel via `npm-run-all`. Editing a `.graphql` file regenerates
  `src/queries/operations-types.ts` automatically. App at http://localhost:3000.
- `npm run codegen` — one-shot codegen.
- `npm run build` — production build; writes the Netlify SSR function to
  `.netlify/v1/functions/server.mjs`.
- `npm run typecheck` — `tsc --noEmit`. The TanStack Router plugin regenerates
  `src/routeTree.gen.ts` when the dev server runs (or on build); a fresh
  checkout that hasn't run dev yet may show a missing-route type error until the
  tree is generated.

## Architecture

The whole point of this repo is the SSR data layer wiring. Read these files
together, not separately:

- **`vite.config.ts`** — registers `fontdue-js/vite` (sets up CJS interop for
  `react-relay` / `relay-runtime` and friends, `ssr.noExternal`, dep
  pre-bundling, and `define: { global: 'globalThis' }`) and
  `@netlify/vite-plugin-tanstack-start` (emits the Netlify SSR function). If
  imports of fontdue-js subpaths break in dev or build, the fontdue-js plugin
  or its included-dep list is the first place to look.

- **`src/lib/graphql.ts`** — `export const fetchGraphql = createFontdueFetch()`,
  a single module-scoped server fetcher from `fontdue-js/server`. It resolves
  the Fontdue URL from `VITE_FONTDUE_URL` / `PUBLIC_FONTDUE_URL` / `FONTDUE_URL`,
  POSTs the query, unwraps `data`, and throws `FontdueNotFoundError` on a 404.
  There is no per-request binding: the global request middleware (below) wraps
  every request in `runWithPreview`, so this fetcher — and every fontdue-js
  preload helper — automatically forwards the admin preview token when an admin
  is previewing, and sends a plain request otherwise. Call them with just their
  variables; preview rides the ambient context.

- **`src/lib/preview.ts` + `src/start.ts`** — the preview + caching layer.
  TanStack Start has no root-route middleware like RR7; instead a **global
  request middleware** (`createMiddleware({ type: 'request' })`) is registered on
  the Start instance via `createStart({ requestMiddleware: [...] })` in
  `src/start.ts`. The Start plugin auto-discovers `src/start.ts` (it resolves a
  `start` entry from the src dir, exporting `startInstance`) — no import or
  registration elsewhere is needed. The middleware's `server` fn gets
  `{ request, next }`; `next()` returns the rendered `Response`. It:
  1. **Preview.** Wraps the render in `runWithPreview(request, …)` from
     `fontdue-js/preview/server`, which puts the admin token (from the preview
     cookie set by `/api/preview`) into an AsyncLocalStorage context for the
     whole render so every fetch/preload reveals unpublished fonts, and forces
     preview responses out of the shared CDN cache (`Cache-Control: no-store`).
     This relies on the middleware running in the same runtime as the render,
     which holds for the Netlify Functions (Node) SSR target.
  2. **CDN caching.** Applies `Netlify-CDN-Cache-Control` SWR + `Netlify-Cache-Tag:
     fontdue` to public, non-preview HTML responses only.

- **`src/routes/__root.tsx`** — the layout-level data layer. Its `loader` runs
  `loadFontdueProviderQuery()` and `fetchGraphql<RootLayoutQuery>(…)` in
  parallel — one round-trip for the whole layout. `<FontdueProvider
  preloadedQuery={…}>` commits the aux payload into the shared client Relay env
  on hydration so theme/banner/tracking render with no flash. It also mounts the
  **admin preview toolbar** automatically (shown only to logged-in admins).
  `<StoreModal>` is mounted with **no** `preloadedQuery` — it's a lazy-only
  component (closed at SSR, fetches on open); don't add a preload there. Cache
  headers are NOT set here — the global middleware owns them for every page.

- **Page route loaders** (`src/routes/index.tsx`, `fonts.$slug.tsx`,
  `test-fonts.tsx`) — each `loader` calls the matching `load*Query` for the
  components it renders, in parallel via `Promise.all`, alongside any
  `fetchGraphql` chrome fetch. Each component is rendered with its own
  `preloadedQuery` prop. The 6 components with a preload helper (BuyButton,
  CharacterViewer, NewsletterSignup, TestFontsForm, TypeTester, TypeTesters) are
  preloaded; the 3 lazy-only ones (StoreModal, CartButton, CustomerLoginForm)
  are just rendered.

- **`src/routes/api.preview.ts`** — server-route handlers (POST enter / DELETE
  exit) delegating to `handlePreviewRequest` from `fontdue-js/preview`. The
  toolbar POSTs a short-lived admin token here to set the preview cookies. The
  default path is `/api/preview`; to change it, set `config.preview.endpoint` on
  `<FontdueProvider>` and rename the route.

- **`src/routes/api.revalidate.ts`** — POST-only server route. Validates
  `?token=` against `process.env.REVALIDATE_TOKEN` and calls Netlify's
  `purgeCache({ tags: ['fontdue'] })`. Wired into Fontdue at **Website settings →
  Deploy hook URL**.

- **`src/queries/*.graphql`** — query documents imported with Vite's `?raw`
  suffix so the string inlines at build time. Types live in
  `src/queries/operations-types.ts` (committed), generated by
  `@graphql-codegen/cli` (config in `codegen.ts`).

Backend URL: `VITE_FONTDUE_URL` in `.env`. fontdue-js auto-reads it from
`import.meta.env` on both server and client — no explicit `configure()` call.
The default tenant `https://example.fontdue.xyz` has CORS allow-listed
`http://localhost:3000`; pointing at another tenant requires that tenant to
allow-list the dev origin.

## Conventions specific to this repo

- Always preload in parallel with `Promise.all` when a route has multiple
  `load*Query` / `fetchGraphql` calls — that's the established pattern.
- The same component import (e.g. `fontdue-js/TypeTester`) yields both the loader
  (`load*Query` named export) and the component (default export).
- Mount exactly one `<FontdueProvider>` per page (in `__root.tsx`). It owns the
  aux UI (ThemeConfig, TestModeBanner, ConsentBanner, Tracking, the admin
  toolbar); per-component islands self-wrap internally without claiming that slot.
- Routes are file-system based (`src/routes/`). The TanStack Router plugin
  regenerates `src/routeTree.gen.ts`.
- Preview: never thread the token by hand. `runWithPreview` (wired once in
  `src/start.ts`) makes every server fetch/preload pick it up from ambient
  context. If you ever move to a split edge runtime where AsyncLocalStorage can't
  cross to the render, fall back to reading the cookie and passing
  `previewAuthHeaders(token)` via each call's `headers` option.

## Caching

CDN SWR caching is set in `src/lib/preview.ts` (the global request middleware),
not per route. Default policy: `s-maxage=300` (5 min fresh on edge) +
`stale-while-revalidate=86400`. Browser `Cache-Control: max-age=0,
must-revalidate` so users always hit the edge. Preview responses are forced to
`private, no-store` by `runWithPreview`, and `/api/*` + non-HTML responses are
left untouched.
