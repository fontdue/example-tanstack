import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useLocation,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { createServerFn } from '@tanstack/react-start'
import { setResponseHeaders } from '@tanstack/react-start/server'
import FontdueProvider, { loadFontdueProviderQuery } from 'fontdue-js/FontdueProvider'
import StoreModal from 'fontdue-js/StoreModal'
import CartButton, { loadCartButtonQuery } from 'fontdue-js/CartButton'

import appCss from '../styles.css?url'
import 'fontdue-js/fontdue.css'
import { fetchGraphql } from '../lib/graphql'
import RootLayoutDoc from '../queries/RootLayout.graphql?raw'
import type { RootLayoutQuery } from '../queries/operations-types'

// CDN-side caching for SSR pages on Netlify. The edge serves cached
// HTML instantly while regenerating in the background, so the page
// feels static (sub-100ms TTFB) without prerendering. Browsers always
// revalidate (`max-age=0`) so users see whatever the edge currently
// holds. Tag every page with `fontdue` so /api/revalidate can purge
// them all at once when Fontdue data changes. The api/revalidate
// route overrides this with `Cache-Control: no-store` on its own
// response object.
const setCdnCacheHeaders = createServerFn({ method: 'GET' }).handler(
  async () => {
    setResponseHeaders({
      'Netlify-CDN-Cache-Control':
        'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Netlify-Cache-Tag': 'fontdue',
    } as never)
  },
)

export const Route = createRootRoute({
  // The root loader is the SSR data layer — equivalent to Astro's
  // frontmatter or RR7's root `loader`. fontdue-js Relay preloads and
  // the raw RootLayout GraphQL fetch run in parallel: one network
  // round-trip's worth of latency for the whole layout. The fontdue
  // payloads commit into the client Relay env on hydration; the
  // GraphQL data drives the static chrome (logo, nav, footer,
  // settings). The server-only header call is sequenced alongside the
  // fetches via Promise.all to keep latency flat.
  loader: async () => {
    const [, fontduePreload, cartPreload, layoutData] = await Promise.all([
      setCdnCacheHeaders(),
      loadFontdueProviderQuery(),
      loadCartButtonQuery(),
      fetchGraphql<RootLayoutQuery>('RootLayout', RootLayoutDoc),
    ])
    return { fontduePreload, cartPreload, layoutData }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'fontdue-js on TanStack Start' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
})

function NotFound() {
  return (
    <section className="py-12">
      <h1 className="mb-4 text-2xl">Not found</h1>
      <p className="text-sm text-gray-500">
        The requested page could not be found.
      </p>
    </section>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{ position: 'bottom-right' }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}

function RootComponent() {
  const { fontduePreload, cartPreload, layoutData } = Route.useLoaderData()
  const { viewer } = layoutData
  const settings = viewer.settings
  const pages =
    viewer.pages?.edges?.flatMap((edge) => (edge?.node ? [edge.node] : [])) ??
    []
  const moreThanOneCollection =
    (viewer.fontCollections?.edges?.length ?? 0) > 1

  const ui = settings?.uiFontStyle
  const uiSource = ui?.webfontSources?.find((s) => s?.format === 'woff2')
  const uiFontFaceCSS =
    ui && uiSource?.url
      ? `@font-face {
           font-family: "${ui.cssFamily} ${ui.name}";
           src: url(${uiSource.url}) format("woff2");
           font-weight: 400; font-style: normal;
         }
         body { font-family: "${ui.cssFamily} ${ui.name}", -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif; }`
      : ''

  return (
    <FontdueProvider preloadedQuery={fontduePreload}>
      <StoreModal />
      {settings?.faviconMarkup && (
        <span dangerouslySetInnerHTML={{ __html: settings.faviconMarkup }} />
      )}
      {settings?.htmlHead && (
        <span dangerouslySetInnerHTML={{ __html: settings.htmlHead }} />
      )}
      {uiFontFaceCSS && (
        <style dangerouslySetInnerHTML={{ __html: uiFontFaceCSS }} />
      )}
      <SiteHeader
        viewer={viewer}
        pages={pages}
        moreThanOneCollection={moreThanOneCollection}
        cartPreload={cartPreload}
      />
      <main className="mx-auto max-w-3xl p-8 font-sans">
        <Outlet />
      </main>
      {settings?.footerText && (
        <footer
          className="prose prose-sm mx-auto mt-16 mb-8 max-w-3xl px-8 text-gray-500"
          dangerouslySetInnerHTML={{ __html: settings.footerText }}
        />
      )}
    </FontdueProvider>
  )
}

function SiteHeader({
  viewer,
  pages,
  moreThanOneCollection,
  cartPreload,
}: {
  viewer: RootLayoutQuery['viewer']
  pages: NonNullable<
    NonNullable<
      NonNullable<RootLayoutQuery['viewer']['pages']>['edges']
    >[number]
  >['node'][]
  moreThanOneCollection: boolean
  cartPreload: Awaited<ReturnType<typeof loadCartButtonQuery>>
}) {
  const { pathname } = useLocation()
  const isActive = (href: string) => pathname === href
  const linkClass = (href: string) =>
    `text-gray-800 no-underline hover:underline ${
      isActive(href) ? 'font-semibold' : 'font-normal'
    }`

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-8 py-4">
      <nav className="flex items-center gap-4">
        <Link to="/" className={linkClass('/')}>
          {viewer.logo ? (
            <img
              src={viewer.logo.url}
              alt={viewer.settings?.title ?? 'Logo'}
              width={(viewer.logo.meta.width ?? 100) / 2}
              height={(viewer.logo.meta.height ?? 100) / 2}
              className="block"
            />
          ) : (
            (viewer.settings?.title ?? 'Home')
          )}
        </Link>
        {moreThanOneCollection && (
          <Link to="/" className={linkClass('/')}>
            Fonts
          </Link>
        )}
        {pages.map(
          (node) =>
            node && (
              // Plain <a> — these CMS-driven slugs aren't part of the
              // typed route tree.
              <a
                key={node.id}
                href={`/${node.slug?.name ?? ''}`}
                className={linkClass(`/${node.slug?.name ?? ''}`)}
              >
                {node.title}
              </a>
            ),
        )}
        <Link to="/test-fonts" className={linkClass('/test-fonts')}>
          Test fonts
        </Link>
      </nav>
      <CartButton preloadedQuery={cartPreload} suffix=" ({count})" />
    </header>
  )
}
