/* ==========================================================================
   GET /api/staff/token/{token}?office_id=folsom     — AUTHENTICATED
   Contract: docs/03 §4.7

   The technician's side of the handoff. They type or scan the token the
   customer was called on, and the application appears.

   WHY THIS ENDPOINT IS THE SENSITIVE ONE
   --------------------------------------
   The short token (A-042) is not a credential. It is printed on a ticket and
   called out across a lobby; it is short and sequential because it has to be
   (docs/03 §5.1). Everything that makes lookup-by-token safe is here, and
   nowhere else:

     1. AUTHENTICATION  — no identity, no answer. There is no customer-side
                          route anywhere in this application that retrieves an
                          application by token.
     2. OFFICE SCOPE    — office_id is required and the lookup is scoped to it,
                          so a token overheard at one office is useless at
                          another.
     3. DAY SCOPE       — expiry is enforced on read, so yesterday's A-042 does
                          not resolve to today's customer, or to anyone.
     4. TOKEN ONLY      — there is no listing, no search by name, no bulk
                          export (docs/03 §5, "Staff authorisation"). One
                          token, one application.
     5. AUDIT           — every view is logged with the staff identity. The log
                          records THAT an access occurred and BY WHOM; it never
                          records what the application said (docs/03 §3.4).
     6. RATE LIMIT      — see below. Tokens are sequential because they are
                          called aloud, so an authenticated insider could
                          otherwise walk A-001 upwards and pull every
                          application in the building. Audit makes that
                          visible after the fact; the limit makes it slow.
   ========================================================================== */

import { NextResponse } from 'next/server';
import { completeness, missingRequired } from '@/lib/reg343';
import { authenticateStaff, mayAccessOffice } from '@/lib/server/auth';
import { store } from '@/lib/server/store';
import { startRetentionSweeper } from '@/lib/server/retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* A technician serving a counter opens perhaps twenty applications an hour.
   This allows twelve times that, so it never interferes with real work, while
   turning a sweep of a thousand sequential tokens into something that takes
   over an hour and leaves a thousand audit entries against one named
   individual. Keyed to the staff identity rather than the IP: every
   workstation in a field office shares one address. */
const LOOKUP_LIMIT = 60;
const LOOKUP_WINDOW_MS = 5 * 60_000;

export async function GET(
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

  /* Office scope is not optional. Without it the token would be a global key,
     and a token is not unique across offices — A-042 exists in every lobby. */
  if (!officeId) {
    return NextResponse.json({ error: 'office_id_required' }, { status: 400 });
  }

  if (!mayAccessOffice(identity, officeId)) {
    return NextResponse.json({ error: 'forbidden_office' }, { status: 403 });
  }

  const limit = await store.rateLimit(
    `staff-lookup:${identity.staff_id}`,
    LOOKUP_LIMIT,
    LOOKUP_WINDOW_MS
  );
  if (!limit.allowed) {
    /* A miss is not an audit event — there is no session to record it against,
       and docs/03 §3.4 keys the audit log to a session. But a technician
       hitting this limit is the signature of a sweep through sequential
       tokens, and the successful views alone would not show it: most of a
       sweep is 404s. Logged here so the operational alert exists even though
       the audit trail cannot carry it. */
    console.warn(
      '[security] staff lookup rate limit tripped — staff=' + identity.staff_id,
      'office=' + officeId
    );
    return NextResponse.json(
      { error: 'rate_limited', retry_after_seconds: limit.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  const session = await store.findByToken(decodeURIComponent(token), officeId);
  if (!session) {
    /* Same answer for "no such token", "wrong office" and "expired at close of
       business yesterday". A technician who mistypes learns only that there is
       nothing to show. */
    return NextResponse.json({ error: 'token_not_found' }, { status: 404 });
  }

  /* Audited BEFORE the data is returned, so a response that fails to reach the
     workstation still leaves a record that the lookup happened. */
  await store.recordAudit({
    session_id: session.session_id,
    token_number: session.token_number,
    office_id: session.office_id,
    staff_id: identity.staff_id,
    action: 'view',
    field_changed: null,
  });

  /* Driver License: there is no application to show, by design. The technician
     gets the eDL 44 confirmation number to look up in DMV's own system, and
     this product has never held anything else about that customer. */
  if (session.service !== 'VR') {
    return NextResponse.json(
      {
        token_number: session.token_number,
        service: session.service,
        sub_transaction: session.sub_transaction,
        status: session.status,
        form_type: null,
        edl_confirmation_number: session.edl_confirmation_number,
        edl_recorded_at: session.edl_recorded_at,
        issued_at: session.issued_at,
        expires_at: session.expires_at,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return NextResponse.json(
    {
      token_number: session.token_number,
      service: session.service,
      sub_transaction: session.sub_transaction,
      status: session.status,
      form_type: 'REG_343',
      form_data: session.form_data,
      completeness: completeness(session.form_data),
      /* The technician needs to know what to ask for, so they get the
         labels as well as the ids. Still no free-text search and no listing —
         this is one application, reached by one token. */
      missing_required: missingRequired(session.form_data).map((m) => m.id),
      missing_required_detail: missingRequired(session.form_data),
      issued_at: session.issued_at,
      updated_at: session.updated_at,
      submitted_at: session.submitted_at,
      expires_at: session.expires_at,
    },
    {
      /* Never cached, anywhere. This is the one response in the product that
         carries a complete REG 343. */
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, private' },
    }
  );
}
