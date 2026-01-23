import type { LoaderFunctionArgs } from 'react-router'

/**
 * Chrome DevTools discovery endpoint
 * Required for debugging SSR Lambda functions
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Return empty array to satisfy Chrome DevTools
  return new Response(JSON.stringify([]), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

export default function DevtoolsRoute() {
  return null
}
