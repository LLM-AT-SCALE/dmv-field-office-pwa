/* ==========================================================================
   Customer-side session: the API client, and the local mirror of the draft.

   TWO STORES, ONE SOURCE OF TRUTH PER CONCERN.

   The SERVER holds the application (lib/server/store.ts). Every answer is
   PATCHed field by field as it is typed, so the technician sees the form even
   if the customer never presses submit and even if the phone dies.

   The BROWSER holds a mirror of the same draft, plus the session id itself.
   The id is needed because there is no cookie and no account — losing it loses
   the ticket. The draft is mirrored because the API exposes no read of
   form_data (GET /api/session/{id} returns queue state only), so a page reload
   would otherwise show an empty form over a server-side draft that is not
   empty. Both copies die together: purgeLocalSession() runs on expiry, on
   "leave the queue", and whenever the server reports the session gone.
   ========================================================================== */

import type { FieldValue, FormData as Reg343Data, ServiceCode } from '@/lib/types';

/** Where the browser keeps the ticket between reloads. */
export const SESSION_KEY = 'fopwa.session';

export interface LocalSession {
  session_id: string;
  office_id: string;
  token_number: string;
  service: ServiceCode;
  sub_transaction: string;
  issued_at: string;
  expires_at: string;
  submitted_at: string | null;
  edl_confirmation_number: string | null;
  form_data: Reg343Data;
}

/* ---- local mirror -------------------------------------------------------- */

export function readLocalSession(): LocalSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalSession;
    if (!parsed || typeof parsed.session_id !== 'string') return null;
    /* An older shape, or a hand-edited entry, must not crash the app. */
    return { ...parsed, form_data: parsed.form_data ?? {} };
  } catch {
    /* Safari private browsing throws on localStorage; so does malformed JSON.
       Either way the customer starts fresh rather than seeing an error. */
    return null;
  }
}

export function writeLocalSession(session: LocalSession): void {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* Storage unavailable — the ticket holds for this tab only. */
  }
}

export function purgeLocalSession(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* Nothing to do: there is no copy to remove. */
  }
}

export function isLocallyExpired(session: LocalSession, now: Date = new Date()): boolean {
  return new Date(session.expires_at) <= now;
}

/* ---- API client ----------------------------------------------------------

   Every call is no-store. Queue figures are the one thing in this product that
   must never be served stale: a cached position sends someone to the counter
   at the wrong moment, which is worse than showing them nothing.
   -------------------------------------------------------------------------- */

const NO_STORE: RequestInit = { cache: 'no-store' };

export interface ServiceWaitView {
  waitMinutes: number;
  depth: number;
}

export interface OfficeSnapshot {
  waits: Record<ServiceCode, ServiceWaitView>;
  isOpen: boolean;
}

interface OfficeResponseService {
  code: ServiceCode;
  wait_minutes: number;
  queue_depth: number;
}

/** Live wait times for both queues. Null when the office cannot be reached. */
export async function fetchOfficeSnapshot(officeId: string): Promise<OfficeSnapshot | null> {
  try {
    const res = await fetch(`/api/office/${encodeURIComponent(officeId)}`, NO_STORE);
    if (!res.ok) return null;
    const body = (await res.json()) as {
      services: OfficeResponseService[];
      hours: { is_open: boolean };
    };
    const waits = { VR: { waitMinutes: 0, depth: 0 }, DL: { waitMinutes: 0, depth: 0 } } as Record<
      ServiceCode,
      ServiceWaitView
    >;
    body.services.forEach((s) => {
      waits[s.code] = { waitMinutes: s.wait_minutes, depth: s.queue_depth };
    });
    return { waits, isOpen: body.hours.is_open };
  } catch {
    return null;
  }
}

export interface IssuedTicket {
  session_id: string;
  token_number: string;
  service: ServiceCode;
  sub_transaction: string;
  expires_at: string;
}

/** Takes a ticket. Throws when the queue could not issue one. */
export async function issueTicket(
  officeId: string,
  service: ServiceCode,
  subTransaction: string,
): Promise<IssuedTicket> {
  const res = await fetch(`/api/office/${encodeURIComponent(officeId)}/token`, {
    ...NO_STORE,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service, sub_transaction: subTransaction }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || 'token_failed');
  }
  return (await res.json()) as IssuedTicket;
}

export interface QueueStatus {
  position: number;
  nowServing: string;
  waitMinutes: number;
  called: boolean;
  near: boolean;
  status: string;
  submittedAt: string | null;
  expiresAt: string;
}

/** 'gone' means expired or never existed — the two are deliberately the same
    answer from the API, and the interface treats both as a closed ticket. */
export async function fetchQueueStatus(sessionId: string): Promise<QueueStatus | 'gone' | null> {
  try {
    const res = await fetch(`/api/session/${encodeURIComponent(sessionId)}`, NO_STORE);
    if (res.status === 404) return 'gone';
    if (!res.ok) return null;
    const body = (await res.json()) as {
      position: number;
      now_serving: string;
      estimated_wait_minutes: number;
      called: boolean;
      near: boolean;
      status: string;
      submitted_at: string | null;
      expires_at: string;
    };
    return {
      position: body.position,
      nowServing: body.now_serving,
      waitMinutes: body.estimated_wait_minutes,
      called: body.called,
      near: body.near,
      status: body.status,
      submittedAt: body.submitted_at,
      expiresAt: body.expires_at,
    };
  } catch {
    /* Offline. Keep whatever figure is on screen rather than blanking it. */
    return null;
  }
}

/** One field, one request. A dropped connection loses this answer and no
    other — which is the whole reason this is a PATCH and not a PUT. */
export async function patchField(
  sessionId: string,
  field: string,
  value: FieldValue,
): Promise<boolean> {
  try {
    const res = await fetch(`/api/session/${encodeURIComponent(sessionId)}/application`, {
      ...NO_STORE,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, value: value === undefined ? null : value }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface SubmitResult {
  submittedAt: string;
}

export async function submitApplication(sessionId: string): Promise<SubmitResult | null> {
  try {
    const res = await fetch(`/api/session/${encodeURIComponent(sessionId)}/submit`, {
      ...NO_STORE,
      method: 'POST',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { submitted_at: string };
    return { submittedAt: body.submitted_at };
  } catch {
    return null;
  }
}

export type DlReferenceResult = { ok: true } | { ok: false; detail: string };

/** The only driver licence field this product ever stores. */
export async function saveDlReference(
  sessionId: string,
  confirmationNumber: string,
): Promise<DlReferenceResult> {
  try {
    const res = await fetch(`/api/session/${encodeURIComponent(sessionId)}/dl-reference`, {
      ...NO_STORE,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation_number: confirmationNumber }),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as { detail?: string } | null;
    return { ok: false, detail: body?.detail || 'invalid_confirmation_number' };
  } catch {
    return { ok: false, detail: 'network' };
  }
}

/** Customer-requested deletion. Immediate, and it does not wait for close of
    business — someone who changes their mind should not have to find staff. */
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    await fetch(`/api/session/${encodeURIComponent(sessionId)}`, { ...NO_STORE, method: 'DELETE' });
  } catch {
    /* The end-of-day purge is the backstop. */
  }
}
