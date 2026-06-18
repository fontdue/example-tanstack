import { createFileRoute } from '@tanstack/react-router'
import TestFontsForm, {
  loadTestFontsFormQuery,
} from 'fontdue-js/TestFontsForm'
import NewsletterSignup, {
  loadNewsletterSignupQuery,
} from 'fontdue-js/NewsletterSignup'

export const Route = createFileRoute('/test-fonts')({
  // This page only preloads fontdue-js components. When an admin is previewing,
  // these reveal unpublished fonts too — preview rides the ambient context set
  // by the global request middleware (src/start.ts), so nothing is threaded here.
  loader: async () => {
    const [testFontsPreload, newsletterPreload] = await Promise.all([
      loadTestFontsFormQuery(),
      loadNewsletterSignupQuery(),
    ])
    return { testFontsPreload, newsletterPreload }
  },
  head: () => ({
    meta: [{ title: 'Test fonts — fontdue-js on TanStack Start' }],
  }),
  component: TestFonts,
})

function TestFonts() {
  const { testFontsPreload, newsletterPreload } = Route.useLoaderData()

  return (
    <>
      <h1 className="mb-4 text-2xl">Test fonts</h1>
      <p className="text-sm text-gray-500">
        Two preloaded forms — both hydrate without re-fetching their settings.
      </p>

      <h2 className="mt-10 text-lg">Test fonts form</h2>
      <div className="mt-4 border border-gray-200 p-4">
        <TestFontsForm preloadedQuery={testFontsPreload} />
      </div>

      <h2 className="mt-10 text-lg">Newsletter signup</h2>
      <div className="mt-4 border border-gray-200 p-4">
        <NewsletterSignup
          preloadedQuery={newsletterPreload}
          title="Join the newsletter"
          intro="Get notified about new releases."
        />
      </div>
    </>
  )
}
