/* ==========================================================================
   Office registry, service catalogue and ticket retention — pure functions.

   Ported from legacy-demo/js/store.js. Everything here is pure: no
   localStorage, no location, no Date.now() that a caller cannot override, so
   the same code runs on the server and in the browser.

   Client requirements §2

   The QR poster is one of five ways in. What the product actually needs is an
   OFFICE IDENTIFIER, however the customer arrived:

     QR poster            →  /?office=folsom
     Short URL            →  dmv.ca.gov/go/folsom      (rewrites to the above)
     Appointment email    →  a deep link carrying the same identifier
     Digital signage      →  displays the QR
     Lobby staff          →  point at the poster

   Nothing in the interface may assume a QR scan. In production this registry
   is served by the Office Registry API (architecture §2.2); here it is static.
   ========================================================================== */

import type { ChecklistItem, Office, Service, ServiceCode, Session } from './types';

export const OFFICES: Record<string, Office> = {
  folsom: {
    id: 'folsom',
    name: 'Folsom Field Office',
    address: '323 Iron Point Road, Folsom, CA 95630',
    hours: { open: '08:00', close: '17:00', today: 'Mon – Fri, 8:00am to 5:00pm', timeZone: 'America/Los_Angeles' },
    layout: [
      'Windows 1–6 — Vehicle Registration',
      'Windows 7–12 — Driver License',
      'Window 13 — Knowledge tests and photos',
      'Self-service terminals — by the north entrance'
    ]
  },
  'sacramento-south': {
    id: 'sacramento-south',
    name: 'Sacramento South Field Office',
    address: '4700 Broadway, Sacramento, CA 95820',
    hours: { open: '08:00', close: '17:00', today: 'Mon – Fri, 8:00am to 5:00pm', timeZone: 'America/Los_Angeles' },
    layout: [
      'Windows 1–9 — Vehicle Registration',
      'Windows 10–18 — Driver License',
      'Windows 19–20 — Knowledge tests and photos',
      'Behind-the-wheel tests — east parking lot'
    ]
  },
  roseville: {
    id: 'roseville',
    name: 'Roseville Field Office',
    address: '1310 Blue Oaks Boulevard, Roseville, CA 95678',
    hours: { open: '08:00', close: '17:00', today: 'Mon – Fri, 8:00am to 5:00pm', timeZone: 'America/Los_Angeles' },
    layout: [
      'Windows 1–5 — Vehicle Registration',
      'Windows 6–10 — Driver License',
      'Window 11 — Knowledge tests and photos'
    ]
  }
};

export const DEFAULT_OFFICE = 'folsom';

/* Pull an office identifier out of a /o/folsom style path, so the production
   short URL can rewrite to either a path or a query parameter without the app
   caring which. Returns null when the path carries none. */
export function officeIdFromPath(pathname: string): string | null {
  const m = /\/o\/([a-z0-9-]+)/i.exec(pathname || '');
  return m ? m[1] : null;
}

/* Strict lookup: the office with this identifier, or null. Use this where a
   wrong answer is worse than no answer — an API returning wait times, say,
   must not quietly report a different office's queue because a QR code was
   misread. Use resolveOffice() where a page has to render regardless. */
export function findOffice(id?: string | null): Office | null {
  return OFFICES[String(id || '').toLowerCase()] || null;
}

/* Resolve the office from an identifier, whichever route brought the customer
   here. Always returns an office — never null — so no entry point can render a
   broken page. */
export function resolveOffice(id?: string | null): Office {
  const key = String(id || '').toLowerCase();

  if (key && OFFICES[key]) return OFFICES[key];

  /* An unknown identifier means a mistyped short URL or a poster for an office
     we do not have data for. Fall back rather than showing a broken page, and
     flag it so the customer is not misled about which office they are in. */
  if (key) return { ...OFFICES[DEFAULT_OFFICE], unresolved: key };

  return OFFICES[DEFAULT_OFFICE];
}

export const SERVICES: Record<ServiceCode, Service> = {
  VR: {
    code: 'VR',
    name: 'Vehicle Registration',
    prefix: 'A',
    blurb: 'Renewals, title transfers, out-of-state vehicles',
    subs: [
      { id: 'renewal',     label: 'Registration renewal' },
      { id: 'transfer',    label: 'Title transfer' },
      { id: 'outofstate',  label: 'Out-of-state vehicle' },
      { id: 'duplicate',   label: 'Duplicate title or registration' }
    ]
  },
  DL: {
    code: 'DL',
    name: 'Driver License',
    prefix: 'B',
    blurb: 'Renewals, replacements, REAL ID, first-time applicants',
    subs: [
      { id: 'renewal',     label: 'Driver license renewal' },
      { id: 'replacement', label: 'Replacement license' },
      { id: 'firsttime',   label: 'First-time applicant' },
      { id: 'realid',      label: 'REAL ID upgrade' }
    ]
  }
};

/* Document checklists — content owned by DMV Program in production */
export const CHECKLISTS: Record<string, ChecklistItem[]> = {
  'VR:renewal': [
    { t: 'Renewal notice or current registration card', h: 'The renewal notice speeds this up considerably.' },
    { t: 'Proof of current insurance', h: 'Must show the vehicle by VIN or plate.' },
    { t: 'Smog certification', h: 'Not required for vehicles under four model years old.' },
    { t: 'Payment for registration fees', h: 'Card or cheque. Fees vary by vehicle value and county.' }
  ],
  'VR:transfer': [
    { t: 'Signed vehicle title (pink slip)', h: 'Signed by the seller in the correct place.' },
    { t: 'Bill of sale', h: 'Showing the sale price and date.' },
    { t: 'Odometer reading', h: 'Required for vehicles under ten model years old.' },
    { t: 'Smog certification', h: 'Provided by the seller unless exempt.' },
    { t: 'Transfer fee and use tax', h: 'Use tax is based on the purchase price.' }
  ],
  'VR:outofstate': [
    { t: 'Out-of-state title and registration', h: 'Both original documents.' },
    { t: 'Vehicle verification (REG 31)', h: 'A physical inspection of the VIN.' },
    { t: 'Smog certification', h: 'Required for most vehicles entering California.' },
    { t: 'Weight certificate', h: 'Commercial vehicles and pickups only.' },
    { t: 'Proof of insurance' }
  ],
  'VR:duplicate': [
    { t: 'Photo identification' },
    { t: 'Vehicle plate or VIN' },
    { t: 'Duplicate title fee' }
  ],
  'DL:renewal': [
    { t: 'Current or expired California driver license' },
    { t: 'Payment for the renewal fee' },
    { t: 'Vision screening', h: 'Carried out at the counter.' }
  ],
  'DL:replacement': [
    { t: 'Photo identification' },
    { t: 'Replacement fee' }
  ],
  'DL:firsttime': [
    { t: 'Proof of identity', h: 'Birth certificate or valid passport.' },
    { t: 'Social security number', h: 'Bring the card if you have it.' },
    { t: 'Two proofs of California residency' },
    { t: 'Completed application', h: 'Complete this online before you reach the counter.' },
    { t: 'Application fee' }
  ],
  'DL:realid': [
    { t: 'One proof of identity', h: 'Certified birth certificate, valid passport, or permanent resident card.' },
    { t: 'Proof of social security number', h: 'Card, W-2, or pay stub showing the full number.' },
    { t: 'Two proofs of California residency', h: 'Utility bill, bank statement, rental agreement. Both must show your name and address.' },
    { t: 'Name change documents', h: 'Only if your name differs across the documents above.' },
    { t: 'Application fee' }
  ]
};

/* The checklist for a service and sub-transaction, or an empty list when the
   pair has no content yet. */
export function checklistFor(service: ServiceCode, subTransaction: string): ChecklistItem[] {
  return CHECKLISTS[`${service}:${subTransaction}`] || [];
}

/* ==========================================================================
   Retention — client requirements §10.1, architecture §3.5

   A ticket and its application data live for one visit and no longer. With
   autosave writing from the first keystroke, every abandoned form leaves
   personal data behind, so this purge is not housekeeping — it is the control
   that keeps the product a handoff buffer rather than a record system, and it
   is the claim the security review will test.

   Expiry is the earlier of: the technician completing the transaction, or the
   close of business on the day the ticket was issued.
   ========================================================================== */

/* Every office in this registry is a California field office. */
export const DEFAULT_TIME_ZONE = 'America/Los_Angeles';

/* Wall-clock parts of an instant, as read in `timeZone`. */
function zonedParts(instant: number, timeZone: string): Record<string, number> {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const parts: Record<string, number> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return parts;
}

/* How far `timeZone` is from UTC at a given instant, in ms. Derived by reading
   the clock in that zone rather than from a table, so DST is handled by the
   platform's own tz database. */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - (instant - (instant % 1000));
}

/* The instant at which the clock in `timeZone` reads the given wall-clock time. */
function zonedTimeToInstant(
  y: number, month: number, day: number,
  h: number, min: number, sec: number, ms: number,
  timeZone: string
): number {
  const guess = Date.UTC(y, month - 1, day, h, min, sec, ms);
  const offset = zoneOffsetMs(guess, timeZone);
  const result = guess - offset;
  /* Re-read at the candidate instant: on a DST boundary the offset that
     applies to the answer is not the one that applied to the guess. */
  const settled = zoneOffsetMs(result, timeZone);
  return settled === offset ? result : guess - settled;
}

/* Close of business on the day the token was issued, from that office's hours.
   Takes either the office or its 24-hour 'HH:MM' closing time.

   Resolved in the OFFICE's timezone, never the server's. This function decides
   when a customer's application data is destroyed, so a host in another zone
   must not be able to move that moment: on a UTC host a naive local-time
   calculation puts a Californian office's "17:00" at 10:00 Pacific, and a
   ticket issued at 09:00 would purge the customer's half-typed form while they
   were still standing in the queue. The timezone is data (OfficeHours.timeZone),
   not a deployment setting. */
export function expiryFor(
  issuedAtISO: string,
  closeTimeOrOffice?: string | Office,
  timeZone?: string
): string {
  const office = typeof closeTimeOrOffice === 'object' && closeTimeOrOffice
    ? closeTimeOrOffice
    : undefined;
  const closeTime = typeof closeTimeOrOffice === 'string'
    ? closeTimeOrOffice
    : office?.hours?.close;
  const zone = timeZone || office?.hours?.timeZone || DEFAULT_TIME_ZONE;

  const issued = new Date(issuedAtISO).getTime();
  const [h, m] = (closeTime || '17:00').split(':').map(Number);
  const today = zonedParts(issued, zone);

  let close = zonedTimeToInstant(today.year, today.month, today.day, h, m, 0, 0, zone);
  /* A ticket issued after closing time (staff overrun) still expires tonight. */
  if (close <= issued) {
    close = zonedTimeToInstant(today.year, today.month, today.day, 23, 59, 59, 999, zone);
  }
  return new Date(close).toISOString();
}

/* Takes anything carrying an expiry — a whole Session, or the one field of it
   a caller happens to hold. */
export function isExpired(
  session: Pick<Session, 'expires_at'> | null | undefined,
  now: Date = new Date()
): boolean {
  if (!session || !session.expires_at) return false;
  return new Date(session.expires_at) <= now;
}

/* Partition sessions into those still live and those past their expiry. The
   caller does the storing; this only decides. */
export function splitExpired(
  sessions: Session[],
  now: Date = new Date()
): { live: Session[]; expired: Session[] } {
  const live: Session[] = [];
  const expired: Session[] = [];
  sessions.forEach(s => (isExpired(s, now) ? expired : live).push(s));
  return { live, expired };
}
