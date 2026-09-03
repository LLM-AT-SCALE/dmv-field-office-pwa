/* ==========================================================================
   /counter — the technician's screen.

   A thin server shell around the client screen. It exists as a server
   component for one reason: the office identifier arrives in the query string
   (`/counter?office=folsom`), and resolving it here means the client never has
   to reach for useSearchParams — which would otherwise need a Suspense
   boundary and a loading flicker on the one screen that must be ready the
   instant a scanner fires.

   THE OFFICE IS PART OF THE ADDRESS. Token lookup is scoped to one office
   because A-042 exists in every lobby (docs/03 §5.1), so the workstation's
   bookmark carries the identifier and the screen never guesses. An identifier
   that does not resolve falls back to the default office AND SAYS SO: without
   that, a technician pointed at the wrong office gets "no such ticket" for
   every token they try and no explanation why.

   NOT INDEXED. This view returns a complete REG 343 to an authenticated
   technician; it has no business in a search index or in a crawler's cache.
   ========================================================================== */

import type { Metadata } from "next"

import { resolveOffice } from "@/lib/office"
import { CounterScreen } from "@/components/counter/counter-screen"

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/* `office` is what the customer-side links carry; `office_id` is what the
   staff API calls it. Accept both rather than making a technician learn which
   spelling this particular URL wanted. */
async function officeFrom(searchParams: PageProps<"/counter">["searchParams"]) {
  const params = await searchParams
  return resolveOffice(first(params.office) ?? first(params.office_id))
}

export async function generateMetadata({
  searchParams,
}: PageProps<"/counter">): Promise<Metadata> {
  const office = await officeFrom(searchParams)

  return {
    title: `Counter — ${office.name}`,
    robots: { index: false, follow: false },
  }
}

export default async function CounterPage({ searchParams }: PageProps<"/counter">) {
  /* The whole office, not a handful of scalars: the screen formats every
     timestamp on the clock at that office, in its own zone. */
  return <CounterScreen office={await officeFrom(searchParams)} />
}
