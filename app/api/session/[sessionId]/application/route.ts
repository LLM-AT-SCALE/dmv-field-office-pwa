/* ==========================================================================
   PATCH /api/session/{sessionId}/application
   Contract: docs/03 §4.4 · Client requirements §4 · docs/04 §5.1

   Field-level patch, NOT a whole-document put. A dropped connection loses one
   field and never the form. That is the difference between a customer
   re-typing a VIN and a customer re-typing an entire REG 343 on a phone, in a
   waiting room, on two bars of signal.

   Autosave is server-side from the first keystroke. Nothing is stored only on
   the phone, so a customer who never presses submit still arrives at the
   counter with their data present — which is the whole reason for replacing
   the localStorage prototype, where the phone and the counter laptop had no
   way to talk to each other.

   The cost is stated plainly in docs/04 §5.1: personal data reaches this
   endpoint for every started form, including every abandoned one. That is why
   the rule in lib/server/retention.ts is load-bearing rather than
   housekeeping, and why the read and the write below both go through it.
   ========================================================================== */

import { NextResponse } from 'next/server';
import type { FieldValue, Reg343FieldId } from '@/lib/types';
import { fieldById, setFieldValue } from '@/lib/reg343';
import { store } from '@/lib/server/store';
import { readLiveSession } from '@/lib/server/retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** No REG 343 answer needs more than this; the longest is an address line. */
const MAX_VALUE_LENGTH = 500;

/* Field names that must never be accepted, on any path, under any spelling.

   docs/03 §5: "SSN — never collected by this product under any path." The
   REG 343 inventory contains no SSN field, so this refuses nothing legitimate
   today. It exists so that a future form change, a copied field name or an
   over-helpful client cannot quietly make that claim untrue. The server
   refuses the field rather than trusting the form definition to keep omitting
   it. */
const FORBIDDEN_FIELD = /(^|[._-])(ssn|social.?security)([._-]|$)/i;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  /* Purge on read, and again on write below. A patch arriving after close of
     business is dropped: it does not recreate the session and it does not
     extend expiry. No code path in this application writes to expires_at after
     the token is issued. */
  const session = await readLiveSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
  }

  /* THE DRIVER LICENCE PATH STORES NO APPLICATION DATA AT ALL.
     DL 44 is completed at edl.dmv.ca.gov and this product keeps only the
     confirmation number (docs/03 §3.3, PROJECT_GUIDE §4). Refusing the write
     here is what makes "no DL identity data is held by this product" a
     property of the server rather than a promise about the client. Use
     POST /api/session/{sessionId}/dl-reference instead. */
  /* A transaction the technician has closed out, or flagged abandoned, takes
     no more writes. Neither status is reachable today — completing hard-
     deletes the session, so there is nothing left to patch — but the enum
     carries both, and an autosave that silently reopened a closed transaction
     would be a bad way to discover that a future staff flow sets them. */
  if (session.status === 'complete' || session.status === 'abandoned') {
    return NextResponse.json({ error: 'session_closed', status: session.status }, { status: 409 });
  }

  if (session.service !== 'VR') {
    return NextResponse.json(
      {
        error: 'application_not_available_for_service',
        service: session.service,
        detail:
          'Driver License applications are completed at edl.dmv.ca.gov. Only the confirmation number is stored.',
      },
      { status: 409 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { field, value } = (body ?? {}) as { field?: unknown; value?: unknown };

  if (typeof field !== 'string' || !field) {
    return NextResponse.json({ error: 'invalid_field' }, { status: 400 });
  }

  if (FORBIDDEN_FIELD.test(field)) {
    /* Logged without the value, deliberately. Knowing that something tried to
       write an SSN field is useful; recording the number in a log while
       refusing to store it in the draft would be absurd. */
    console.warn('[security] refused write to forbidden field', field, 'session', sessionId);
    return NextResponse.json(
      { error: 'forbidden_field', detail: 'This product never collects a social security number.' },
      { status: 422 }
    );
  }

  /* ALLOWLIST, not a pattern match. The field must exist in the REG 343
     inventory (docs/02 §3). An unknown name is rejected outright rather than
     stored, so form_data can only ever contain fields that appear on the
     printed form — the store cannot be used as free storage keyed to a token,
     and a prototype-pollution key such as __proto__ never reaches an
     assignment because it is not a REG 343 field. */
  const definition = fieldById(field);
  if (!definition) {
    return NextResponse.json({ error: 'unknown_field', field }, { status: 400 });
  }

  /* fieldById() matches any field in the schema regardless of conditional
     visibility, so it accepts an answer to a question not currently on screen
     — a motorcycle engine number typed before the customer switched the
     vehicle type back to Auto, say. That is deliberate for an allowlist: the
     customer may change their mind and change it back, and dropping their
     earlier answer would lose work. The consequence is that a key present in
     form_data does NOT mean the customer was asked that question. Nothing
     downstream is confused by this — completeness(), missingRequired() and the
     PDF fill all work from the visible field set — but do not read form_data
     as a record of what was asked. */

  /* Numbers are accepted from the client and stored as strings: every REG 343
     answer is written into an AcroForm text field in the end, and a single
     representation avoids "1999" and 1999 behaving differently downstream. */
  let normalised: FieldValue;
  if (value === null || value === undefined || value === '') {
    normalised = undefined;
  } else if (typeof value === 'boolean') {
    normalised = value;
  } else if (typeof value === 'string' || typeof value === 'number') {
    normalised = String(value);
  } else {
    return NextResponse.json({ error: 'invalid_value' }, { status: 400 });
  }

  if (typeof normalised === 'string' && normalised.length > MAX_VALUE_LENGTH) {
    return NextResponse.json(
      { error: 'value_too_long', max_length: MAX_VALUE_LENGTH },
      { status: 413 }
    );
  }

  /* The write goes through the store rather than mutating the object read
     above, so a replacement store (Redis, or a managed database if DMV IT
     requires one) has one place to persist from. updateSession re-checks
     expiry, so retention is enforced on the write as well as on the read. */
  const updated = await store.updateSession(sessionId, (s) => {
    /* An empty value clears the field rather than storing "". A customer who
       deletes what they typed should leave nothing behind, not an empty string
       the completeness figure then has to special-case. */
    setFieldValue(s.form_data, field as Reg343FieldId, normalised);

    s.updated_at = new Date().toISOString();

    /* Editing after submitting is allowed — the customer is still in the queue
       and may spot a mistake. The status returns to a draft state so the
       technician's screen does not claim the form is finished while it is
       being changed underneath them. */
    if (s.status === 'submitted') {
      s.status = 'waiting';
      s.submitted_at = null;
    }
  });

  if (!updated) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
  }

  /* 204, no body. There is nothing useful to return, and echoing the value
     back would put personal data in a response for no reason. */
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
