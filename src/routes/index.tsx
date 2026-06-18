import { Link, createFileRoute } from '@tanstack/react-router'
import TypeTester, { loadTypeTesterQuery } from 'fontdue-js/TypeTester'

import { fetchGraphql } from '../lib/graphql'
import IndexDoc from '../queries/Index.graphql?raw'
import type { IndexQuery } from '../queries/operations-types'

// The route loader is the SSR data layer: a regular GraphQL fetch and
// the fontdue-js Relay preloads run together in one Promise.all. The
// Relay payloads hydrate the islands without an extra round-trip; the
// GraphQL data drives the static markup of the page. In preview, both
// reveal unpublished fonts automatically — preview rides the ambient
// context set by the global request middleware (src/start.ts).
export const Route = createFileRoute('/')({
  loader: async () => {
    const indexData = await fetchGraphql<IndexQuery>('Index', IndexDoc)

    const collections =
      indexData.viewer.fontCollections?.edges?.flatMap((edge) =>
        edge?.node && edge.node.slug ? [edge.node] : [],
      ) ?? []

    // Demo: hydrate a TypeTester for the first two collections returned
    // by the API instead of hard-coding family/style names.
    const testerCollections = collections
      .filter((c) => c.featureStyle?.cssFamily && c.featureStyle.name)
      .slice(0, 2)

    const testerPreloads = await Promise.all(
      testerCollections.map((c) =>
        loadTypeTesterQuery({
          familyName: c.featureStyle!.cssFamily!,
          styleName: c.featureStyle!.name!,
        }),
      ),
    )

    return { collections, testerCollections, testerPreloads }
  },
  head: () => ({
    meta: [
      { title: 'fontdue-js on TanStack Start' },
      {
        name: 'description',
        content: 'Server-preloaded TypeTester hydrated with no re-fetch.',
      },
    ],
  }),
  component: Home,
})

function Home() {
  const { collections, testerCollections, testerPreloads } =
    Route.useLoaderData()

  // Inject @font-face for each collection's feature style so the
  // homepage can render collection names in their own font without an
  // extra island.
  const featureFontFaces = collections
    .map((c) => {
      const style = c.featureStyle
      const src = style?.webfontSources?.find((s) => s?.format === 'woff2')
      if (!style || !src?.url) return ''
      return `@font-face {
        font-family: "${style.cssFamily} ${style.name}";
        src: url(${src.url}) format("woff2");
        font-weight: 400; font-style: normal;
      }`
    })
    .filter(Boolean)
    .join('\n')

  return (
    <>
      {featureFontFaces && (
        <style dangerouslySetInnerHTML={{ __html: featureFontFaces }} />
      )}
      <h1 className="mb-4 text-2xl">Fonts</h1>
      <p className="text-sm text-gray-500">
        Server-rendered from <code>Index.graphql</code>. Each collection name
        is set in its own feature style; the type testers below are
        server-preloaded Relay islands.
      </p>

      <section className="my-6 flex flex-col gap-2">
        {collections.map((node) => (
          <h2
            key={node.id}
            className="m-0 text-5xl leading-tight"
            style={{
              ['--optical-adjustment' as never]: node.opticalAdjustment ?? 0,
            }}
          >
            <Link
              to="/fonts/$slug"
              params={{ slug: node.slug!.name! }}
              className="text-inherit no-underline hover:underline"
              style={{
                fontFamily: `"${node.featureStyle?.cssFamily} ${node.featureStyle?.name}", system-ui, sans-serif`,
              }}
            >
              {node.name}
            </Link>
            {node.isNew && (
              <span className="align-super text-xs text-red-700">
                &nbsp;New
              </span>
            )}
          </h2>
        ))}
      </section>

      {testerCollections.length > 0 && (
        <>
          <h2 className="mt-10 text-lg">Try them out</h2>
          {testerCollections.map((c, i) => (
            <div
              key={c.id}
              className="mt-6 border border-gray-200 p-4"
            >
              <p className="mb-2 text-sm text-gray-500">
                {c.name} — {c.featureStyle?.name}
              </p>
              <TypeTester
                preloadedQuery={testerPreloads[i]}
                content="The quick brown fox jumps over the lazy dog"
                fontSize={48}
              />
            </div>
          ))}
        </>
      )}
    </>
  )
}
