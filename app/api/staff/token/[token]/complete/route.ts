/* ==========================================================================
   POST /api/staff/token/{token}/complete?office_id=folsom   — AUTHENTICATED
   Contract: docs/03 §4.8 · Retention §3.5

   The technician has finished the transaction. The session, the REG 343 draft
   and the DL reference are HARD-DELETED, immediately and irreversibly.

   This is the first of the two retention triggers — the other being close of
   business, which lib/server/retention.ts enforces on every read, on every
   write and on a timer. Whichever comes first wins.

   There is no soft delete, no archive, no tombstone and no backup of
   application content. After this call there is nothing left to retrieve, for
   staff or for anyone else, and the customer's registration data exists only
   on the paper they are about to sign and in DMV's own systems where it
   belongs. That is what makes this product a handoff buffer rather than a
   record system, and it is the single most important argument in the security
   review (docs/03 §3.5).

   What survives is the audit log: that a transaction was completed, by which
   staff member, at what time, against which token. It has never contained a
   field value, so deleting the application does not orphan a copy of it in
   the log (docs/03 §3.4).
   ========================================================================== */

import { NextResponse } from 'next/server';
import { authenticateStaff, mayAccessOffice } from '@/lib/server/auth';
import { store } from '@/lib/server/store';
import { purgeSession, startRetentionSweeper } from '@/lib/server/retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  startRetentionSweeper();

  const identity = authenticateStaff(request);
  if (!identity) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { token } = await params;
  const officeId = new URL(request.url).searchParams.get('office_id')?.trim();
  if (!officeId) {
    return NextResponse.json({ error: 'office_id_required' }, { status: 400 });
  }

  if (!mayAccessOffice(identity, officeId)) {
    return NextResponse.json({ error: 'forbidden_office' }, { status: 403 });
  }

  const session = await store.findByToken(decodeURIComponent(token), officeId);
  if (!session) {
    return NextResponse.json({ error: 'token_not_found' }, { status: 404 });
  }

  /* Two audit events, deliberately. 'complete' records the business action the
     technician took; 'purge' records the data deletion that followed. A
     reviewer asking "was this application deleted, and when?" gets a direct
     answer without inferring it from the completion. */
  await store.recordAudit({
    session_id: session.session_id,
    token_number: session.token_number,
    office_id: session.office_id,
    staff_id: identity.staff_id,
    action: 'complete',
    field_changed: null,
  });

  await purgeSession(session, 'completed', identity.staff_id);

  return new NextResponse(null, { status: 204 });
}
