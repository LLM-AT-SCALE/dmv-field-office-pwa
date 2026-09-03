/* ==========================================================================
   Counter view — the shapes the staff API returns.

   These mirror app/api/staff/token/[token]/route.ts field for field. They are
   declared here rather than derived from the store's own types on purpose: the
   route deliberately returns LESS than it holds (no session_id, and for a
   Driver License ticket no application at all), and a type that says so is a
   standing reminder of what the counter is allowed to see.
   ========================================================================== */

import type { FormData, ServiceCode, SessionStatus } from "@/lib/types"

/* What the technician sees for a Vehicle Registration ticket: the whole
   REG 343, because that is the transaction they are about to process. */
export interface Reg343Record {
  token_number: string
  service: "VR"
  sub_transaction: string
  status: SessionStatus
  form_type: "REG_343"
  form_data: FormData
  /** 0–1. Computed server-side over the fields visible for these answers. */
  completeness: number
  missing_required: string[]
  missing_required_detail: { section: string; id: string; label: string }[]
  issued_at: string
  updated_at?: string | null
  submitted_at: string | null
  expires_at: string
}

/* What the technician sees for a Driver License ticket: a confirmation number
   and nothing else, because nothing else was ever collected. The eDL 44 lives
   at edl.dmv.ca.gov and the customer's identity data stays in DMV's own
   systems — this product has never held it. */
export interface DlRecord {
  token_number: string
  service: "DL"
  sub_transaction: string
  status: SessionStatus
  form_type: null
  edl_confirmation_number: string | null
  edl_recorded_at?: string | null
  issued_at: string
  expires_at: string
}

export type StaffRecord = Reg343Record | DlRecord

export function isReg343(record: StaffRecord): record is Reg343Record {
  return record.service === "VR"
}

/* --------------------------------------------------------------------------
   Queue rail

   GET /api/staff/queue?office_id=… — ticket metadata only, the same class of
   information as the call-board on the lobby wall. No application content: the
   REG 343 still requires a token lookup, one ticket at a time.

   The endpoint may not be present. Everything downstream treats the rail as an
   optional convenience and falls back to the tickets this technician has
   looked up in this session — see useQueue().
   -------------------------------------------------------------------------- */

export interface QueueTicket {
  token_number: string
  service: ServiceCode
  sub_transaction: string
  seq: number
  status: SessionStatus
  /** Whether an eDL 44 reference exists — never the number itself. */
  has_edl_reference: boolean
  /**
   * Whether the customer has typed anything at all. Existence, not a measure
   * of content: the rail deliberately gets no completeness figure, because
   * that would let a technician survey how far along everyone in the lobby is
   * without opening a single application.
   */
  has_draft?: boolean
  issued_at: string
  /** Last write to the draft — a started form from an abandoned one. */
  updated_at?: string | null
  expires_at: string
}

export interface QueueFeed {
  office_id: string
  now_serving: Record<ServiceCode, string>
  tickets: QueueTicket[]
}

/* --------------------------------------------------------------------------
   Failures the screen has to say something useful about
   -------------------------------------------------------------------------- */

export type LookupFailure =
  /** No such ticket at this office today — or it has already been purged. */
  | "not_found"
  /** No staff identity. The SSO stub in lib/server/auth.ts fails closed. */
  | "unauthenticated"
  /** Signed in, but not for this office. */
  | "forbidden"
  /** Too many lookups too fast — the anti-enumeration limit on the route. */
  | "rate_limited"
  | "network"

export interface LookupError {
  kind: LookupFailure
  /** The token as the technician typed or scanned it. */
  token: string
}
