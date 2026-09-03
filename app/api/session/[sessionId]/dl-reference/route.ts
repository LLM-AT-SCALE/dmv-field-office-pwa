/* ==========================================================================
   POST /api/session/{sessionId}/dl-reference
   Contract: docs/03 §4.6 · Data model §3.3

   THE ONLY DRIVER LICENCE FIELD THIS PRODUCT EVER STORES.

   DMV does not permit DL 44 to be downloaded — every printed copy carries its
   own barcode, so a downloaded copy is not valid. DMV already publishes an
   online version at edl.dmv.ca.gov which issues a confirmation number that
   counter staff can look up. So the product does not rebuild that form: it
   links out, and stores the confirmation number against the token.

   The consequence is worth stating because it is the strongest privacy claim
   in the product: for the Driver License path this application holds NO SSN,
   NO name, NO date of birth, NO address and NO documents. Just a reference
   number that is meaningless without DMV's own systems.

   That is a product requirement, not a schema convenience (docs/03 §3.3), so
   the server enforces it: this handler reads exactly one key out of the
   request body and discards everything else it was sent. A client that posts
   a name alongside the confirmation number does not get that name stored.
   ========================================================================== */

import { NextResponse } from 'next/server';
import { store } from '@/lib/server/store';
import { readLiveSession } from '@/lib/server/retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* eDL 44 confirmation numbers are short alphanumeric references. The pattern
   is intentionally loose on format and strict on shape: it must not be
   possible to smuggle a sentence of personal data through this field. */
const CONFIRMATION_NUMBER = /^[A-Za-z0-9][A-Za-z0-9-]{3,39}$/;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const session = await readLiveSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
  }

  if (session.service !== 'DL') {
    return NextResponse.json(
      { error: 'not_a_driver_license_session', service: session.service },
      { status: 409 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  /* Destructure exactly one key. Anything else the client sent is not read,
     not logged and not stored — by construction, not by discipline. */
  const { confirmation_number } = (body ?? {}) as { confirmation_number?: unknown };

  if (typeof confirmation_number !== 'string' || !CONFIRMATION_NUMBER.test(confirmation_number.trim())) {
    return NextResponse.json(
      {
        error: 'invalid_confirmation_number',
        detail: 'Enter the confirmation number from your eDL 44 email.',
      },
      { status: 400 }
    );
  }

  const recorded_at = new Date().toISOString();
  const updated = await store.updateSession(sessionId, (s) => {
    s.edl_confirmation_number = confirmation_number.trim().toUpperCase();
    s.edl_recorded_at = recorded_at;
    s.updated_at = recorded_at;
  });
  if (!updated) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
  }

  /* 204, no body. The number is not echoed back; the client already has it. */
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
