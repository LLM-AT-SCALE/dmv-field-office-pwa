/* ==========================================================================
   Counter view — the two staff calls, and the optional queue feed.

   AUTHENTICATION. Nothing here sends a staff credential, deliberately.
   lib/server/auth.ts is a STUB with a TODO for DMV single sign-on: it accepts
   an `x-dmv-staff-id` header from any caller in development and FAILS CLOSED in
   a production build. Setting that header from the browser would make the stub
   authenticate every production request as one hard-coded technician, which is
   precisely the accident the fail-closed branch exists to prevent. So the
   counter sends nothing, works under the development identity, and renders an
   honest "staff sign-on is not wired up yet" state when the server says 401.
   When SSO lands the session cookie travels with `credentials: 'same-origin'`
   and no call site here changes.
   ========================================================================== */

import { normaliseToken } from "@/lib/queue"
import type { LookupFailure, QueueFeed, StaffRecord } from "./types"

/* Thrown by the calls below; the screen maps `kind` onto what it tells the
   technician. */
export class StaffApiError extends Error {
  readonly kind: LookupFailure

  constructor(kind: LookupFailure, message: string) {
    super(message)
    this.name = "StaffApiError"
    this.kind = kind
  }
}

function kindFor(status: number): LookupFailure {
  if (status === 401) return "unauthenticated"
  if (status === 403) return "forbidden"
  if (status === 404) return "not_found"
  /* The lookup route rate-limits per staff identity, because sequential tokens
     would otherwise let an authenticated insider walk the whole building. */
  if (status === 429) return "rate_limited"
  return "network"
}

const NO_STORE: RequestInit = {
  /* This response carries a complete REG 343. It is not cached anywhere, by
     anyone — the route says so in its headers and the request says so too. */
  cache: "no-store",
  credentials: "same-origin",
}

/**
 * One ticket, by the token the technician typed or scanned.
 *
 * The token is normalised before it goes anywhere: a Code 39 scanner may
 * transmit the start/stop asterisks (`*A-042*`), and a technician typing in a
 * hurry produces stray spaces and lower case. normaliseToken() in lib/queue is
 * the same function the server matches with.
 */
export async function fetchRecord(
  token: string,
  officeId: string,
  signal?: AbortSignal
): Promise<StaffRecord> {
  const wanted = normaliseToken(token)
  if (!wanted) throw new StaffApiError("not_found", "No token given")

  const url = `/api/staff/token/${encodeURIComponent(wanted)}?office_id=${encodeURIComponent(officeId)}`

  let response: Response
  try {
    response = await fetch(url, { ...NO_STORE, signal })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new StaffApiError("network", "Could not reach the server.")
  }

  if (!response.ok) throw new StaffApiError(kindFor(response.status), `Lookup failed (${response.status})`)

  return (await response.json()) as StaffRecord
}

/**
 * Finish the transaction. The session, the REG 343 draft and the DL reference
 * are hard-deleted server-side — no soft delete, no archive, nothing to
 * retrieve afterwards. There is no undo, which is why the caller confirms
 * first.
 */
export async function completeAndPurge(
  token: string,
  officeId: string
): Promise<void> {
  const wanted = normaliseToken(token)
  const url = `/api/staff/token/${encodeURIComponent(wanted)}/complete?office_id=${encodeURIComponent(officeId)}`

  let response: Response
  try {
    response = await fetch(url, { ...NO_STORE, method: "POST" })
  } catch {
    throw new StaffApiError("network", "Could not reach the server.")
  }

  if (!response.ok) throw new StaffApiError(kindFor(response.status), `Could not complete (${response.status})`)
}

/**
 * The queue rail's feed. Optional by design: if the endpoint is absent the
 * rail falls back to the tickets this technician has already called, so the
 * screen degrades to something still usable rather than to an error.
 */
export async function fetchQueue(
  officeId: string,
  signal?: AbortSignal
): Promise<QueueFeed | null> {
  try {
    const response = await fetch(
      `/api/staff/queue?office_id=${encodeURIComponent(officeId)}`,
      { ...NO_STORE, signal }
    )
    if (!response.ok) return null
    return (await response.json()) as QueueFeed
  } catch {
    return null
  }
}
