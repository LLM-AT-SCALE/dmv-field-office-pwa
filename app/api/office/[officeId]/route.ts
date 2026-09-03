/* ==========================================================================
   GET /api/office/{officeId}
   Contract: docs/03_Technical_Architecture_and_Data_Model.md §4.1

   Office Registry (docs/03 §2.2). Read-only. Holds no personal data.

   The office identifier may have arrived from a QR poster, a short URL, an
   appointment-confirmation link or lobby signage — resolution is identical in
   every case, and nothing here may assume a QR scan (docs/04 §3.1).
   ========================================================================== */

import { NextResponse } from 'next/server';
import type { OfficeHours, ServiceCode } from '@/lib/types';
import { resolveOffice, SERVICES } from '@/lib/office';
import { officeWaits } from '@/lib/queue';
import { store } from '@/lib/server/store';
import { startRetentionSweeper } from '@/lib/server/retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SERVICE_CODES: ServiceCode[] = ['VR', 'DL'];

/* True when the office is open right now, judged by the clock ON THE WALL AT
   THE OFFICE — never the server's.

   The naive version of this function reads now.getDay() and now.getHours(),
   which are the HOST's weekday and hour. That is wrong everywhere except a
   host in the office's own zone: on a UTC server a Californian office would be
   reported open from 01:00 to 10:00 Pacific, and on an Asia/Calcutta host
   (which is what this was developed on) it would be reported open overnight
   and shut all morning. It would also roll over to the next weekday eight
   hours early, so Friday evening would read as Saturday and the office would
   show closed while customers were still queueing in it.

   Same lesson as expiryFor() in lib/office.ts, which resolves close of
   business in the office's zone for the same reason. The zone is data
   (OfficeHours.timeZone), not a deployment setting. */
function isOpenNow(hours: OfficeHours, now: Date = new Date()): boolean {
  const timeZone = hours.timeZone || 'America/Los_Angeles';

  /* Reading a wall clock in another zone, not doing arithmetic across a DST
     boundary — Intl alone is enough here, and there is no offset to invert. */
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);

  const read = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

  // Field offices are Mon–Fri.
  const weekday = read('weekday');
  if (weekday === 'Sat' || weekday === 'Sun') return false;

  const minutes = Number(read('hour')) * 60 + Number(read('minute'));
  const [openH, openM] = hours.open.split(':').map(Number);
  const [closeH, closeM] = hours.close.split(':').map(Number);
  return minutes >= openH * 60 + openM && minutes < closeH * 60 + closeM;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ officeId: string }> }
) {
  startRetentionSweeper();

  const { officeId } = await params;
  const office = resolveOffice(officeId);

  const waits = officeWaits((await store.queueSnapshot(office.id)).state);

  const services = SERVICE_CODES.map((code) => ({
    code,
    name: SERVICES[code].name,
    blurb: SERVICES[code].blurb,
    sub_transactions: SERVICES[code].subs,
    wait_minutes: waits[code].minutes,
    queue_depth: waits[code].depth,
  }));

  return NextResponse.json(
    {
      office_id: office.id,
      name: office.name,
      address: office.address,
      hours: {
        today: { open: office.hours.open, close: office.hours.close },
        /* Sent so the client renders opening times in the office's zone rather
           than the phone's — a customer checking from out of state must see
           the office's 5pm, not their own. */
        time_zone: office.hours.timeZone ?? 'America/Los_Angeles',
        display: office.hours.today,
        is_open: isOpenNow(office.hours),
      },
      layout: office.layout,
      services,
      /* resolveOffice() falls back to the default office rather than failing,
         so an unrecognised short URL still renders something useful. The API
         must not hide that: the identifier that could not be resolved is
         reported so the interface can tell the customer it is showing a
         different office, rather than letting them believe the wait times
         belong to the building they are standing in. */
      unresolved_office_id: office.unresolved ?? null,
    },
    {
      /* This payload carries live wait times. A stale queue figure is worse
         than none at all (docs/03 §2.1), so it is never cached at the edge.
         The service worker's 5-minute fallback is a client-side decision taken
         with the staleness visible to the customer. */
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
