const ENDPOINT = `${import.meta.env.VITE_FONTDUE_URL}/graphql`

export async function fetchGraphql<Q, V = void>(
  queryName: string,
  query: string,
  variables?: V,
): Promise<Q> {
  const response = await fetch(`${ENDPOINT}?query=${queryName}`, {
    method: 'POST',
    body: JSON.stringify({ query, variables }),
    headers: { 'content-type': 'application/json' },
  })

  if (response.status !== 200) {
    throw new Error(`Fontdue request failed: ${response.status}`)
  }

  const json = await response.json()

  const errorMessage = json.errors?.[0]?.message
  if (errorMessage) {
    throw new Error(`Fontdue graphql error: ${errorMessage}`)
  }

  return json.data
}
