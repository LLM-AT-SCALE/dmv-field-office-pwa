/* ==========================================================================
   POST /api/session/{sessionId}/submit
   Contract: docs/03 §4.5

   SUBMISSION WITH MISSING FIELDS IS PERMITTED AND REPORTED, NEVER REJECTED.

   That is a deliberate product decision, not a missing validation. A customer
   whose number is called mid-form must be able to say "I have finished" and
   walk to the counter with whatever they have; the technician finishes the
   rest. Blocking submit on a missing odometer reading would send them back to
   their seat while their turn passes.

   Autosave already means nothing is lost if they never press this at all
   (docs/03 §4.4). Submit exists for one reason: so the technician can tell a
   FINISHED application from an ABANDONED DRAFT (docs/04 §5.1, consequence 2).
   The completeness figure tells them how much of it to expect.
   ========================================================================== */

import { NextResponse } from 'next/server';
import { completeness, formatProblems, missingRequired } from '@/lib/reg343';
import { store } from '@/lib/server/store';
import { readLiveSession } from '@/lib/server/retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const session = await readLiveSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
  }

  const submitted_at = new Date().toISOString();

  /* The Driver License path has no application to submit — DL 44 is completed
     at edl.dmv.ca.gov and this product holds only the confirmation number
     (docs/03 §3.3). "Finished" for a DL customer means that number is
     recorded, so report completeness against that single fact rather than
     refusing the call and forcing the interface into two shapes. */
  if (session.service !== 'VR') {
    const hasReference = Boolean(session.edl_confirmation_number);
    await store.updateSession(sessionId, (s) => {
      s.status = 'submitted';
      s.submitted_at = submitted_at;
      s.updated_at = submitted_at;
    });
    return NextResponse.json(
      {
        submitted_at,
        completeness: hasReference ? 1 : 0,
        missing_required: hasReference ? [] : ['edl_confirmation_number'],
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const data = session.form_data;

  /* missingRequired() reports {section, id, label} so the form UI can build an
     error summary. The API contract in docs/03 §4.5 is a list of field ids;
     the labels are already available to any caller that imports the schema. */
  const missing_required = missingRequired(data).map((m) => m.id);

  const updated = await store.updateSession(sessionId, (s) => {
    s.status = 'submitted';
    s.submitted_at = submitted_at;
    s.updated_at = submitted_at;
  });
  if (!updated) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
  }

  return NextResponse.json(
    {
      submitted_at,
      completeness: completeness(data),
      missing_required,
      /* Fields that are filled in but fail their format check — a VIN of the
         wrong length, a plate that is not seven characters. ADVISORY ONLY.
         They are reported alongside a successful 200, never as a 422: the
         whole point of this endpoint is that a customer whose number is being
         called can hand over what they have. Presenting these as blocking
         errors in the interface would undo that. The technician fixes them at
         the counter, which is where the signature happens anyway. */
      format_problems: formatProblems(data),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
