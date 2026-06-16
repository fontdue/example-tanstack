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
import FontdueProvider, { loadFontdueProviderQuery } from 'fontdue-js/FontdueProvider'
import StoreModal from 'fontdue-js/StoreModal'
import CartButton from 'fontdue-js/CartButton'

import appCss from '../styles.css?url'
import 'fontdue-js/fontdue.css'
import { fetchGraphql } from '../lib/graphql'
import RootLayoutDoc from '../queries/RootLayout.graphql?raw'
import type { RootLayoutQuery } from '../queries/operations-types'

export const Route = createRootRoute({
  // The root loader is the SSR data layer — equivalent to Astro's
  // frontmatter or RR7's root `loader`. fontdue-js Relay preloads and
  // the raw RootLayout GraphQL fetch run in parallel: one network
  // round-trip's worth of latency for the whole layout. The fontdue
  // payloads commit into the client Relay env on hydration; the
  // GraphQL data drives the static chrome (logo, nav, footer,
  // settings). In preview both reveal unpublished fonts automatically —
  // preview rides the ambient context set by the global request
  // middleware (src/start.ts), so nothing is threaded here.
  //
  // CDN cache headers (and the no-store rewrite for preview) are applied
  // once for every page by that same middleware, not per loader.
  loader: async () => {
    const [fontduePreload, layoutData] = await Promise.all([
      loadFontdueProviderQuery(),
      fetchGraphql<RootLayoutQuery>('RootLayout', RootLayoutDoc),
    ])
    return { fontduePreload, layoutData }
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
  const { fontduePreload, layoutData } = Route.useLoaderData()
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
}: {
  viewer: RootLayoutQuery['viewer']
  pages: NonNullable<
    NonNullable<
      NonNullable<RootLayoutQuery['viewer']['pages']>['edges']
    >[number]
  >['node'][]
  moreThanOneCollection: boolean
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
      <CartButton suffix=" ({count})" />
    </header>
  )
}
