/* ==========================================================================
   POST /api/office/{officeId}/token
   Contract: docs/03 §4.2

   Issues a queue token and creates the session that everything else hangs off.
   This is the only endpoint that creates state, and therefore the only one
   that can be abused to fill the store — hence the rate limits below
   (docs/03 §5, "Rate limiting: per office and per IP on token issue").

   In Phase 1 the token is issued by this application. When the DMV queue
   vendor is identified (docs/03 §2.4, open question 1) the sequence number
   comes from their API instead and this handler becomes a thin proxy; the
   session record and its retention rule do not change.
   ========================================================================== */

import { NextResponse } from 'next/server';
import type { ServiceCode } from '@/lib/types';
import { findOffice, SERVICES } from '@/lib/office';
import { queueFor } from '@/lib/queue';
import { store } from '@/lib/server/store';
import { startRetentionSweeper } from '@/lib/server/retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* Rate limits — docs/03 §5, "per office and per IP on token issue".

   The per-office limit is the meaningful one: a real field office cannot issue
   more than one ticket per second for any length of time, so a caller that
   does is filling the store with personal data rather than serving customers.

   The per-IP limit has to be read carefully, because the obvious value is
   wrong. Customers in a DMV lobby are on the office wifi, behind one NAT
   address: to the server they are all the same IP. A limit tuned to "one
   customer takes one ticket" would lock the lobby out after the fifth person
   of the morning. It is therefore set well above lobby traffic and treated as
   a brake on scripted abuse, not as a per-customer quota — the per-office
   limit is what bounds the damage. */
const OFFICE_LIMIT = 60;
const OFFICE_WINDOW_MS = 60_000;
const IP_LIMIT = 20;
const IP_WINDOW_MS = 10 * 60_000;

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

function isServiceCode(value: unknown): value is ServiceCode {
  return value === 'VR' || value === 'DL';
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ officeId: string }> }
) {
  startRetentionSweeper();

  const { officeId } = await params;
  /* findOffice() is the STRICT lookup: null for an identifier we do not hold.
     Its sibling resolveOffice() falls back to the default office instead, and
     that is right for READING office context — a mistyped short URL still
     shows something useful, flagged as a fallback. It is wrong for ISSUING A
     TICKET. A customer standing in Roseville must not be handed a Folsom
     ticket because a QR code was misread: they would sit waiting for a number
     that is never called, in a building where it does not exist. Reading the
     wrong page is recoverable, holding a worthless ticket is not, so token
     issue refuses what office context tolerates. */
  const office = findOffice(officeId);
  if (!office) {
    return NextResponse.json({ error: 'office_not_found', office_id: officeId }, { status: 404 });
  }

  const officeLimit = await store.rateLimit(`token:office:${office.id}`, OFFICE_LIMIT, OFFICE_WINDOW_MS);
  const ipLimit = await store.rateLimit(`token:ip:${clientIp(request)}`, IP_LIMIT, IP_WINDOW_MS);
  const blocked = !officeLimit.allowed ? officeLimit : !ipLimit.allowed ? ipLimit : null;
  if (blocked) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_seconds: blocked.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(blocked.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { service, sub_transaction } = (body ?? {}) as {
    service?: unknown;
    sub_transaction?: unknown;
  };

  if (!isServiceCode(service)) {
    return NextResponse.json(
      { error: 'invalid_service', allowed: ['VR', 'DL'] },
      { status: 400 }
    );
  }

  /* Validate the sub-transaction against the service's own list rather than
     accepting free text. It reaches the technician's screen, so it must not be
     a channel for arbitrary customer-supplied content. */
  const allowedSubs = SERVICES[service].subs.map((s) => s.id);
  if (typeof sub_transaction !== 'string' || !allowedSubs.includes(sub_transaction)) {
    return NextResponse.json(
      { error: 'invalid_sub_transaction', allowed: allowedSubs },
      { status: 400 }
    );
  }

  const session = await store.createSession({ office, service, sub_transaction });
  const queue = queueFor((await store.queueSnapshot(office.id)).state, session);

  return NextResponse.json(
    {
      /* session_id is the customer's credential for every subsequent call. The
         token_number is NOT — it is read aloud in a lobby (docs/03 §5.1). */
      session_id: session.session_id,
      token_number: session.token_number,
      service: session.service,
      sub_transaction: session.sub_transaction,
      position: queue.position,
      now_serving: queue.nowServing,
      estimated_wait_minutes: queue.waitMinutes,
      /* Returned so the interface can tell the customer plainly when their
         ticket and their data stop existing. Retention that the customer can
         see is retention they can rely on. */
      expires_at: session.expires_at,
    },
    { status: 201, headers: { 'Cache-Control': 'no-store' } }
  );
}
