import { createFileRoute, notFound } from '@tanstack/react-router'
import TypeTesters, { loadTypeTestersQuery } from 'fontdue-js/TypeTesters'
import CharacterViewer, {
  loadCharacterViewerQuery,
} from 'fontdue-js/CharacterViewer'
import BuyButton, { loadBuyButtonQuery } from 'fontdue-js/BuyButton'

import { fetchGraphql } from '../lib/graphql'
import FontDoc from '../queries/Font.graphql?raw'
import type {
  FontQuery,
  FontQueryVariables,
} from '../queries/operations-types'

// Server-preloaded fontdue-js queries hydrate the islands; the GraphQL
// fetch supplies the page chrome (title, description, hero image, buy
// button props). All four run in parallel in one Promise.all. In preview
// this page resolves even for an unpublished collection and its islands
// reveal unpublished styles — preview rides the ambient context set by
// the global request middleware (src/start.ts), so nothing is threaded here.
export const Route = createFileRoute('/fonts/$slug')({
  loader: async ({ params }) => {
    const [
      fontData,
      typeTestersPreload,
      characterViewerPreload,
      buyButtonPreload,
    ] = await Promise.all([
      fetchGraphql<FontQuery, FontQueryVariables>('Font', FontDoc, {
        slug: params.slug,
      }),
      loadTypeTestersQuery({ collectionSlug: params.slug }),
      loadCharacterViewerQuery({ collectionSlug: params.slug }),
      loadBuyButtonQuery({ collectionSlug: params.slug }),
    ])

    const collection = fontData.viewer.slug?.fontCollection
    if (!collection) throw notFound()

    return {
      collection,
      typeTestersPreload,
      characterViewerPreload,
      buyButtonPreload,
    }
  },
  head: ({ loaderData }) => {
    const collection = loaderData?.collection
    const title =
      collection?.pageMetadata?.title ?? collection?.name ?? 'Font detail'
    return { meta: [{ title: `${title} — fontdue-js on TanStack Start` }] }
  },
  component: FontDetail,
})

function FontDetail() {
  const {
    collection,
    typeTestersPreload,
    characterViewerPreload,
    buyButtonPreload,
  } = Route.useLoaderData()

  const feature = collection.featureStyle
  const featureSrc = feature?.webfontSources?.find(
    (s) => s?.format === 'woff2',
  )
  const featureFontFace =
    feature && featureSrc?.url
      ? `@font-face {
          font-family: "${feature.cssFamily} ${feature.name}";
          src: url(${featureSrc.url}) format("woff2");
          font-weight: 400; font-style: normal;
        }`
      : ''

  const heroImage = collection.images?.find((img) => img && img.url)

  return (
    <>
      {featureFontFace && (
        <style dangerouslySetInnerHTML={{ __html: featureFontFace }} />
      )}
      <h1
        className="my-2 mb-4 text-6xl leading-none"
        style={{
          fontFamily: feature
            ? `"${feature.cssFamily} ${feature.name}", system-ui, sans-serif`
            : undefined,
        }}
      >
        {collection.name}
        {collection.collectionType === 'superfamily' && ' Collection'}
      </h1>

      {collection.shortDescription && (
        <p className="mb-6 text-lg text-gray-700">
          {collection.shortDescription}
        </p>
      )}

      {heroImage && (
        <figure className="mb-6">
          {heroImage.meta?.mimeType === 'video/mp4' ? (
            <video
              src={heroImage.url!}
              playsInline
              muted
              autoPlay
              loop
              className="block h-auto w-full"
            />
          ) : (
            <img
              src={heroImage.url!}
              width={heroImage.meta?.width ?? undefined}
              height={heroImage.meta?.height ?? undefined}
              alt={heroImage.description ?? ''}
              className="block h-auto w-full"
            />
          )}
        </figure>
      )}

      <div className="my-4 flex items-center gap-4">
        <BuyButton
          preloadedQuery={buyButtonPreload}
          collectionName={collection.name}
        />
        {collection.minisiteLink && (
          <a href={collection.minisiteLink} target="_blank" rel="noopener">
            {collection.name} Minisite
          </a>
        )}
      </div>

      <h2 className="mt-10 text-lg">TypeTesters</h2>
      <div className="mt-4 border border-gray-200 p-4">
        <TypeTesters preloadedQuery={typeTestersPreload} defaultMode="local" />
      </div>

      {collection.description && (
        <section
          className="prose my-8 max-w-none"
          dangerouslySetInnerHTML={{ __html: collection.description }}
        />
      )}

      <h2 className="mt-10 text-lg">Character viewer</h2>
      <div className="mt-4 border border-gray-200 p-4">
        <CharacterViewer preloadedQuery={characterViewerPreload} />
      </div>
    </>
  )
}
