/* ==========================================================================
   GET    /api/session/{sessionId}   — queue status for that session (§4.3)
   DELETE /api/session/{sessionId}   — customer-requested deletion (§3.5)

   Customer-side endpoints are addressed by session_id, a UUID. They are never
   addressable by token number: the token is short and sequential, so token
   addressing here would let any customer read any other customer's queue
   state by typing a nearby number (docs/03 §5.2, first two threat rows).
   ========================================================================== */

import { NextResponse } from 'next/server';
import { queueFor } from '@/lib/queue';
import { store } from '@/lib/server/store';
import { purgeSession, readLiveSession } from '@/lib/server/retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* Status polling is expected to be frequent — the customer is watching their
   position move. The limit is set well above a sensible poll interval and
   exists only to stop a client stuck in a tight loop (docs/03 §5). */
const STATUS_LIMIT = 240;
const STATUS_WINDOW_MS = 60_000;

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const limit = await store.rateLimit(`status:ip:${clientIp(request)}`, STATUS_LIMIT, STATUS_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_seconds: limit.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  /* readLiveSession enforces retention on the way through: an expired session
     is hard-deleted here and reported as absent. */
  const session = await readLiveSession(sessionId);
  if (!session) {
    /* Deliberately identical for "never existed" and "expired at close of
       business". The caller learns nothing about which. */
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
  }

  const queue = queueFor((await store.queueSnapshot(session.office_id)).state, session);

  return NextResponse.json(
    {
      token_number: session.token_number,
      service: session.service,
      sub_transaction: session.sub_transaction,
      position: queue.position,
      now_serving: queue.nowServing,
      estimated_wait_minutes: queue.waitMinutes,
      /* The interface needs to distinguish "you are next" from "you are being
         called now" to decide whether to interrupt the customer mid-form. */
      called: queue.called,
      near: queue.near,
      status: session.status,
      submitted_at: session.submitted_at,
      updated_at: session.updated_at,
      expires_at: session.expires_at,
    },
    {
      /* Queue position is NEVER cached, at the edge or in the service worker
         (docs/03 §6). A stale position sends a customer to the counter at the
         wrong moment, which is worse than showing them nothing. */
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}

/**
 * Customer-requested deletion — docs/03 §3.5, fourth retention trigger.
 *
 * Immediate hard delete of the session, its draft and its DL reference. A
 * customer who changes their mind must be able to remove their data without
 * finding a member of staff, and without waiting for close of business.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await readLiveSession(sessionId);

  /* Deleting something already gone is a success from the caller's point of
     view, and answering 404 here would confirm which session ids exist. */
  if (!session) return new NextResponse(null, { status: 204 });

  await purgeSession(session, 'customer_request', 'customer');
  return new NextResponse(null, { status: 204 });
}
