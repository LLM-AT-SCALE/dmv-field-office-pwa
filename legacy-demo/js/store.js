/* ==========================================================================
   Demo store — mocked queue and session state.
   Persisted to localStorage so the officer view can read what the customer
   submitted. In production this is the backend Session & Draft Store
   (docs/03_Technical_Architecture_and_Data_Model.md §3).
   ========================================================================== */

const KEY_SESSIONS = 'fopwa.sessions';
const KEY_CURRENT  = 'fopwa.current';

/* Queue state is per office — two offices must never share a counter. */
function queueKey() { return 'fopwa.queue.' + OFFICE.id; }

/* Demo pacing: seconds of real time per customer served.
   Append ?fast to the URL for a rapid demo, ?slow for a realistic one. */
const params = new URLSearchParams(location.search);
const TICK_SECONDS = params.has('fast') ? 4 : params.has('slow') ? 60 : 12;

/* ==========================================================================
   Office registry — client requirements §2

   The QR poster is one of five ways in. What the product actually needs is an
   OFFICE IDENTIFIER, however the customer arrived:

     QR poster            →  /app/index.html?office=folsom
     Short URL            →  dmv.ca.gov/go/folsom      (rewrites to the above)
     Appointment email    →  a deep link carrying the same identifier
     Digital signage      →  displays the QR
     Lobby staff          →  point at the poster

   Nothing in the interface may assume a QR scan. In production this registry
   is served by the Office Registry API (architecture §2.2); here it is static.
   ========================================================================== */

const OFFICES = {
  folsom: {
    id: 'folsom',
    name: 'Folsom Field Office',
    address: '323 Iron Point Road, Folsom, CA 95630',
    hours: { open: '08:00', close: '17:00', today: 'Mon – Fri, 8:00am to 5:00pm' },
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
    hours: { open: '08:00', close: '17:00', today: 'Mon – Fri, 8:00am to 5:00pm' },
    layout: [
      'Windows 1–9 — Vehicle Registration',
      'Windows 10–18 — Driver License',
      'Windows 19–20 — Knowledge tests and photos',
      'Behind-the-wheel tests — east car park'
    ]
  },
  roseville: {
    id: 'roseville',
    name: 'Roseville Field Office',
    address: '1310 Blue Oaks Boulevard, Roseville, CA 95678',
    hours: { open: '08:00', close: '17:00', today: 'Mon – Fri, 8:00am to 5:00pm' },
    layout: [
      'Windows 1–5 — Vehicle Registration',
      'Windows 6–10 — Driver License',
      'Window 11 — Knowledge tests and photos'
    ]
  }
};

const DEFAULT_OFFICE = 'folsom';

/* Resolve the office from the URL, whichever route brought the customer here.
   Accepts ?office=folsom and a /o/folsom path, so the production short URL can
   rewrite to either form without the app caring which. */
function resolveOffice() {
  const fromQuery = params.get('office');
  const fromPath = (location.pathname.match(/\/o\/([a-z0-9-]+)/i) || [])[1];
  const id = (fromQuery || fromPath || '').toLowerCase();

  if (id && OFFICES[id]) return OFFICES[id];

  /* An unknown identifier means a mistyped short URL or a poster for an office
     we do not have data for. Fall back rather than showing a broken page, and
     flag it so the customer is not misled about which office they are in. */
  if (id) {
    const office = { ...OFFICES[DEFAULT_OFFICE], unresolved: id };
    console.warn('[office] unknown identifier', id, '— falling back to', DEFAULT_OFFICE);
    return office;
  }
  return OFFICES[DEFAULT_OFFICE];
}

const OFFICE = resolveOffice();

const SERVICES = {
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
const CHECKLISTS = {
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

/* ---------- queue simulation ---------- */

function queueState() {
  let q = read(queueKey(), null);
  const now = Date.now();
  if (!q) {
    q = { base: now, tick: TICK_SECONDS, servingVR: 38, servingDL: 15, nextVR: 42, nextDL: 19 };
    write(queueKey(), q);
  }
  const tickSeconds = q.tick || TICK_SECONDS;
  const elapsedTicks = Math.floor((now - q.base) / (tickSeconds * 1000));
  let servingVR = q.servingVR + elapsedTicks;
  let servingDL = q.servingDL + Math.floor(elapsedTicks * 0.7);

  /* Self-healing: a demo left running must never present an empty queue.
     When the counters catch up, re-seed so a few people are always ahead. */
  const noLiveTickets = read(KEY_SESSIONS, []).length === 0;
  if (noLiveTickets && (servingVR >= q.nextVR - 1 || servingDL >= q.nextDL - 1)) {
    q.servingVR = Math.max(servingVR, q.nextVR - 4);
    q.servingDL = Math.max(servingDL, q.nextDL - 3);
    q.nextVR = Math.max(q.nextVR, q.servingVR + 4);
    q.nextDL = Math.max(q.nextDL, q.servingDL + 3);
    q.base = now;
    write(queueKey(), q);
    servingVR = q.servingVR;
    servingDL = q.servingDL;
  }

  return { ...q, nowServingVR: servingVR, nowServingDL: servingDL };
}

function issueToken(service) {
  queueState();                     // ensure initialised
  const q = read(queueKey(), null);
  const seq = service === 'VR' ? q.nextVR : q.nextDL;
  if (service === 'VR') q.nextVR = seq + 1; else q.nextDL = seq + 1;
  write(queueKey(), q);
  return { seq, number: SERVICES[service].prefix + '-' + String(seq).padStart(3, '0') };
}

function queueFor(session) {
  const q = queueState();
  const serving = session.service === 'VR' ? q.nowServingVR : q.nowServingDL;
  const position = Math.max(0, session.seq - serving);
  const perPerson = session.service === 'VR' ? 3 : 4; // minutes, mocked
  return {
    position,
    nowServing: SERVICES[session.service].prefix + '-' + String(serving).padStart(3, '0'),
    waitMinutes: position * perPerson,
    called: position === 0,
    near: position > 0 && position <= 2
  };
}

function officeWaits() {
  const q = queueState();
  return {
    VR: { depth: Math.max(0, q.nextVR - q.nowServingVR), minutes: Math.max(0, q.nextVR - q.nowServingVR) * 3 },
    DL: { depth: Math.max(0, q.nextDL - q.nowServingDL), minutes: Math.max(0, q.nextDL - q.nowServingDL) * 4 }
  };
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

/* Close of business on the day the token was issued, from that office's hours. */
function expiryFor(issuedAtISO) {
  const issued = new Date(issuedAtISO);
  const [h, m] = (OFFICE.hours.close || '17:00').split(':').map(Number);
  const close = new Date(issued);
  close.setHours(h, m, 0, 0);
  /* A ticket issued after closing time (staff overrun) still expires tonight. */
  if (close <= issued) close.setHours(23, 59, 59, 999);
  return close.toISOString();
}

function isExpired(session) {
  if (!session || !session.expires_at) return false;
  return new Date(session.expires_at) <= new Date();
}

/* Deletes every expired session. Returns how many were removed.
   In production this is a scheduled job on the server; here it runs on load
   and on a timer, which is the same guarantee from the customer's point of
   view — the data does not outlive the day. */
function purgeExpired() {
  const all = read(KEY_SESSIONS, []);
  const live = all.filter(s => !isExpired(s));
  const removed = all.length - live.length;
  if (removed) {
    write(KEY_SESSIONS, live);
    const current = read(KEY_CURRENT, null);
    if (current && !live.some(s => s.session_id === current)) localStorage.removeItem(KEY_CURRENT);
    console.info('[retention] purged', removed, 'expired session(s)');
  }
  return removed;
}

/* ---------- sessions ---------- */

function allSessions() { purgeExpired(); return read(KEY_SESSIONS, []); }

function saveSession(session) {
  const all = allSessions();
  const i = all.findIndex(s => s.session_id === session.session_id);
  if (i >= 0) all[i] = session; else all.push(session);
  write(KEY_SESSIONS, all);
  return session;
}

function createSession(service, subTransaction) {
  const { seq, number } = issueToken(service);
  const issued = new Date().toISOString();
  const session = {
    session_id: uuid(),
    office_id: OFFICE.id,
    token_number: number,
    seq,
    service,
    sub_transaction: subTransaction,
    issued_at: issued,
    expires_at: expiryFor(issued),
    status: 'waiting',
    form_data: {},
    submitted_at: null,
    edl_confirmation_number: null
  };
  saveSession(session);
  write(KEY_CURRENT, session.session_id);
  return session;
}

function currentSession() {
  purgeExpired();
  const id = read(KEY_CURRENT, null);
  if (!id) return null;
  const s = allSessions().find(x => x.session_id === id) || null;
  if (s && isExpired(s)) { purgeSession(s.session_id); return null; }
  return s;
}

function findByToken(token) {
  /* A barcode scanner behaves like a keyboard. Some models transmit the Code 39
     start/stop asterisks along with the value, so strip them, along with any
     stray whitespace, before matching. */
  const t = String(token || '').trim().toUpperCase().replace(/^\*+|\*+$/g, '').trim();
  return allSessions().find(s => s.token_number.toUpperCase() === t) || null;
}

function purgeSession(session_id) {
  write(KEY_SESSIONS, allSessions().filter(s => s.session_id !== session_id));
  if (read(KEY_CURRENT, null) === session_id) localStorage.removeItem(KEY_CURRENT);
}

function resetDemo() {
  /* Clear every office's queue, not just this one, so a reset during a demo
     leaves nothing behind from a previously visited office. */
  Object.keys(localStorage)
    .filter(k => k.startsWith('fopwa.queue'))
    .forEach(k => localStorage.removeItem(k));
  [KEY_SESSIONS, KEY_CURRENT].forEach(k => localStorage.removeItem(k));
}

/* ---------- utilities ---------- */

function read(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch (e) { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
function fmtMinutes(m) {
  if (m <= 0) return 'now';
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
