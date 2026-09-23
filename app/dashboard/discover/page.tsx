// src/app/dashboard/discover/page.tsx
// Authenticated Discover (swipe cards) — the post-login landing surface.
// Server boundary: reads the first deck batch under the verified session and
// renders it into the client deck. Auth truth: proxy.ts gates /dashboard/*,
// fetchDiscoverBatchAction re-verifies via requireUser.
import { fetchDiscoverBatchAction } from '@/app/actions/discover'
import { DiscoverDeck } from './discover-deck'

export default async function DiscoverPage() {
  const batch = await fetchDiscoverBatchAction(null)

  return <DiscoverDeck initialBatch={batch} />
}
