// src/app/dashboard/connect/page.tsx
// Connect hub — one surface for people AND ideas.
//
// Placement rationale: the nav already labels `/dashboard/connections` "Connect",
// but that page is only a flat connections list. This hub is the intended
// destination: it hosts the whole connect loop (Discover → Ideas → Matches →
// Requests → Sent) as tabs over the SAME server data the dedicated pages read,
// so nothing is duplicated or fabricated.
//
// Server boundary: reads the first Discover deck batch under the verified
// session (mirrors app/dashboard/discover/page.tsx) and hands it to the client
// hub for the interactive tabs. Auth truth stays in proxy.ts (gates
// /dashboard/*) plus requireUser() inside each server action.
import { Suspense } from 'react'

import { fetchDiscoverBatchAction } from '@/app/actions/discover'

import { ConnectHub } from './connect-hub'
import type { DeckBatch } from './types'

export default async function ConnectPage() {
  const batch = (await fetchDiscoverBatchAction(null)) as DeckBatch

  // `useSearchParams` (tab deep-links) needs a Suspense boundary during
  // prerendering — same pattern as app/dashboard/chat/page.tsx.
  return (
    <Suspense fallback={null}>
      <ConnectHub initialBatch={batch} />
    </Suspense>
  )
}
