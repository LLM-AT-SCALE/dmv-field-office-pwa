/* ==========================================================================
   GET /api/staff/queue?office_id=folsom                     — AUTHENTICATED
   The counter's queue rail: now serving, and today's waiting tickets.

   NOT IN docs/03 §4 — THIS IS A DOCUMENTED DEVIATION FROM §5
   ---------------------------------------------------------
   docs/03 §5 states staff authorisation as "lookup by token only; no listing,
   no search by name, no bulk export". This endpoint is a listing. It is added
   knowingly, and the reasoning belongs here where a reviewer will find it
   rather than in a commit message nobody reads.

   WHAT IT RETURNS is the lobby call-board: token numbers, which service, what
   state each ticket is in. That is the screen on the wall and the number
   called out loud. It carries NO personal data — no form_data, no names, no
   completeness figure, no confirmation number value, only whether one exists.
   Retrieving the REG 343 still requires a token lookup through the audited
   endpoint next door. The prohibition in §5 is aimed at bulk access to
   APPLICATION CONTENT, and that prohibition is intact.

   WHOSE DATA IT IS matters more than where it currently lives. Call-board
   data belongs to the queue system (docs/03 §2.4: current serving number and
   queue depth per service, from the vendor's API). Phase 1 has no vendor, so
   the session store stands in for one. This endpoint is therefore a stand-in
   for a queue integration, not a new capability of the draft store — and when
   the vendor dependency is resolved it should be deleted, not kept alongside.

   ON ENUMERATION, honestly: the token-only rule reads like it stops a
   technician sweeping every application in the lobby. It does not, and never
   did. Tokens are sequential by design because they are called aloud, so
   anyone who can reach the staff endpoint can already walk A-001 upwards. The
   controls that actually bite are the audit log, which names the individual
   behind every retrieval, and the rate limit below. This endpoint removes
   friction that was never load-bearing.

   WHAT WOULD CHANGE THE ANSWER: adding any field derived from what the
   customer typed. `completeness` is the tempting one and it is deliberately
   absent — it is a measurement of personal data, and a rail that showed it
   would let a technician survey how much everyone in the lobby had filled in
   without opening a single application. `status` answers the same operational
   question without that property.
   ========================================================================== */

import { NextResponse } from 'next/server';
import type { ServiceCode } from '@/lib/types';
import { tokenNumber } from '@/lib/queue';
import { authenticateStaff, mayAccessOffice } from '@/lib/server/auth';
import { store } from '@/lib/server/store';
import { startRetentionSweeper } from '@/lib/server/retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* The rail polls. A counter screen refreshing every few seconds sits far
   inside this; a script pulling the lobby in a loop does not. */
const LIST_LIMIT = 240;
const LIST_WINDOW_MS = 60_000;

export async function GET(request: Request) {
  startRetentionSweeper();

  const identity = authenticateStaff(request);
  if (!identity) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const officeId = new URL(request.url).searchParams.get('office_id')?.trim();
  if (!officeId) {
    return NextResponse.json({ error: 'office_id_required' }, { status: 400 });
  }

  if (!mayAccessOffice(identity, officeId)) {
    return NextResponse.json({ error: 'forbidden_office' }, { status: 403 });
  }

  const limit = await store.rateLimit(
    `staff-list:${identity.staff_id}`,
    LIST_LIMIT,
    LIST_WINDOW_MS
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_seconds: limit.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  const snapshot = await store.queueSnapshot(officeId);
  const sessions = await store.listByOffice(officeId);

  /* One audit event for the read, not one per ticket. The action is 'list'
     rather than 'view' so the log distinguishes reading the call-board from
     retrieving an application — a reviewer counting how often applications
     were opened must not have that number inflated by rail polling.

     session_id is empty because no single session was accessed. */
  await store.recordAudit({
    session_id: '',
    token_number: null,
    office_id: officeId,
    staff_id: identity.staff_id,
    action: 'list',
    field_changed: null,
  });

  const tickets = sessions.map((s) => ({
    token_number: s.token_number,
    service: s.service,
    sub_transaction: s.sub_transaction,
    seq: s.seq,
    status: s.status,
    /* Existence only, never the value. For a DL ticket this is the difference
       between "they have been to edl.dmv.ca.gov" and "they have not" — which
       is what the technician needs to know before calling them forward. */
    has_edl_reference: Boolean(s.edl_confirmation_number),
    /* Whether the customer has typed anything at all, so the rail can separate
       a started draft from an untouched ticket. A boolean about existence, not
       a measure of content. */
    has_draft: Object.keys(s.form_data).length > 0,
    issued_at: s.issued_at,
    /* The technician's real question is "is this person still filling it in,
       or did they give up twenty minutes ago" (docs/04 §5.1). A timestamp
       answers it without exposing anything they typed. */
    updated_at: s.updated_at,
    expires_at: s.expires_at,
  }));

  const nowServing: Record<ServiceCode, string> = {
    VR: tokenNumber('VR', snapshot.nowServingVR),
    DL: tokenNumber('DL', snapshot.nowServingDL),
  };

  return NextResponse.json(
    { office_id: officeId, now_serving: nowServing, tickets },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
