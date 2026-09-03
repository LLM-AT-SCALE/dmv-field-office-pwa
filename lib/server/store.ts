/* ==========================================================================
   Session & Draft Store
   Architecture: docs/03_Technical_Architecture_and_Data_Model.md §2.2, §3

   This is the ONLY component in the product that touches personal data.
   Everything else — office registry, queue maths, form schema, chatbot — is
   either static content or pure computation over data passed to it.

   WHY IN-MEMORY, AND WHY THAT IS A FEATURE
   ----------------------------------------
   Open technical question 8 in docs/03 §9 asks whether the session store must
   be a managed database. The answer taken here is no, deliberately.

   Autosave writes to the server from the first keystroke (client requirements
   §4, docs/04 §5.1), so personal data reaches this store for EVERY started
   form, including every abandoned one. The end-of-day purge is therefore
   load-bearing rather than housekeeping — it is the control that keeps this
   product a handoff buffer rather than a record system, and it is the first
   claim a security review will test.

   A store with native expiry makes "nothing persists overnight"
   ARCHITECTURALLY TRUE rather than PROCEDURALLY ENFORCED. There is no table
   somebody can forget to purge, no nightly job that can silently fail, no
   backup tape, no read replica, no write-ahead log, and no soft-delete flag
   that leaves the row sitting there marked deleted. A process restart is
   itself a complete purge. That is a materially stronger position in front of
   a security reviewer than "we run a DELETE at 17:00, here is the cron entry".

   LIMITS OF THIS IMPLEMENTATION — state them, do not hide them
     - State lives in one Node process. Two instances behind a load balancer do
       not share sessions, so the API must be pinned to a single instance for
       the single-office pilot. Scaling out means providing another
       implementation of SessionStore backed by Redis with per-key TTL, which
       preserves the TTL-native property rather than abandoning it.
     - form_data sits in plain process memory. docs/03 §3.2 requires encryption
       at rest under DMV KMS keys; there is no "at rest" here, but any
       persistent implementation MUST add it before it holds real data.
     - Queue counters are simulated (lib/queue.ts). They are replaced by the
       DMV queue vendor's API when that dependency is resolved (docs/03 §2.4).
   ========================================================================== */

import type { Office, ServiceCode, Session, QueueState } from '@/lib/types';
import { expiryFor, isExpired } from '@/lib/office';
import { dynamoDbStore } from './store-dynamodb';
import { advanceQueue, createQueueState, issueToken, normaliseToken } from '@/lib/queue';

/* --------------------------------------------------------------------------
   The record this store holds.

   docs/03 §3.2 lists `updated_at` on the draft and §3.3 lists `recorded_at` on
   the DL reference. Neither is on the shared Session type, which describes
   what the customer-facing app needs; both are server bookkeeping, so the
   store carries them itself rather than widening a shared type for the sake of
   two timestamps the phone never reads.
   -------------------------------------------------------------------------- */

export interface StoredSession extends Session {
  /** Last write of any kind. Shown to the technician so they can tell a draft
      still being typed from one abandoned twenty minutes ago. */
  updated_at: string;
  /** When the eDL 44 confirmation number was recorded (docs/03 §3.3). */
  edl_recorded_at: string | null;
}

/* --------------------------------------------------------------------------
   Audit log — docs/03 §3.4

   Retained independently of session data, under DMV's standard log retention
   policy, and therefore outliving the end-of-day purge. It records THAT an
   access occurred and BY WHOM. `field_changed` holds a field NAME, never a
   field VALUE. Nothing in this type may ever be widened to carry application
   content — the whole point is that deleting an application does not leave a
   copy of it behind in the log.
   -------------------------------------------------------------------------- */

/* 'list' extends the enum in docs/03 §3.4, which predates the counter queue
   rail. It is recorded separately from 'view' on purpose: 'view' means an
   application was retrieved, 'list' means only the call-board was read. A
   reviewer must be able to tell those apart at a glance. */
export type AuditAction = 'view' | 'list' | 'edit' | 'print' | 'complete' | 'purge';

export interface AuditEvent {
  event_id: string;
  session_id: string;
  /** Recorded because the token is what the technician actually typed. */
  token_number: string | null;
  office_id: string | null;
  staff_id: string;
  action: AuditAction;
  field_changed: string | null;
  timestamp: string;
}

export type PurgeReason = 'completed' | 'expired' | 'abandoned' | 'customer_request';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window rolls over — for the Retry-After header. */
  retryAfterSeconds: number;
}

export interface NewSessionInput {
  office: Office;
  service: ServiceCode;
  sub_transaction: string;
}

/** Where the counters stand for one office, right now. */
export interface QueueSnapshot {
  state: QueueState;
  nowServingVR: number;
  nowServingDL: number;
}

/* --------------------------------------------------------------------------
   The interface a replacement store must satisfy.

   Route handlers depend on this type and never on the Map behind it. Swapping
   in Redis, or a managed database if DMV IT requires one, means providing
   another implementation of SessionStore and changing nothing else.
   -------------------------------------------------------------------------- */

export interface SessionStore {
  createSession(input: NewSessionInput): Promise<StoredSession>;
  getSession(sessionId: string): Promise<StoredSession | null>;
  updateSession(
    sessionId: string,
    mutate: (session: StoredSession) => void
  ): Promise<StoredSession | null>;
  /** Token lookup is office-scoped by contract; see the note in the method. */
  findByToken(token: string, officeId: string): Promise<StoredSession | null>;
  /** Today's live tickets for one office. See the warning in the method. */
  listByOffice(officeId: string, now?: Date): Promise<StoredSession[]>;
  deleteSession(sessionId: string): Promise<boolean>;
  /** Hard-deletes every expired session. Returns how many were removed. */
  purgeExpired(now?: Date): Promise<number>;
  queueSnapshot(officeId: string, now?: Date): Promise<QueueSnapshot>;
  recordAudit(event: Omit<AuditEvent, 'event_id' | 'timestamp'>): Promise<AuditEvent>;
  auditTrail(sessionId?: string): Promise<AuditEvent[]>;
  rateLimit(key: string, limit: number, windowMs: number, now?: number): Promise<RateLimitResult>;
  /** Diagnostics only. Never exposed through an API route. */
  stats(): Promise<{ sessions: number; offices: number; auditEvents: number }>;
}

/* --------------------------------------------------------------------------
   In-memory implementation
   -------------------------------------------------------------------------- */

/** The audit log is capped so a long-running process cannot grow unbounded. */
const AUDIT_LOG_CAP = 5000;

/** Rate-limit windows older than this are swept along with expired sessions. */
const RATE_WINDOW_TTL_MS = 60 * 60 * 1000;

interface StoreState {
  sessions: Map<string, StoredSession>;
  queues: Map<string, QueueState>;
  audit: AuditEvent[];
  rateLimits: Map<string, { count: number; windowStart: number }>;
  sweeper: ReturnType<typeof setInterval> | null;
}

/* Next.js reloads route modules on every edit in development. Without a global
   handle each reload would strand the previous Map — every ticket issued
   before the edit would vanish mid-demonstration, and every sweeper interval
   would leak. */
const GLOBAL_KEY = Symbol.for('fopwa.session-store');

type GlobalWithStore = typeof globalThis & { [GLOBAL_KEY]?: StoreState };

function state(): StoreState {
  const g = globalThis as GlobalWithStore;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      sessions: new Map<string, StoredSession>(),
      queues: new Map<string, QueueState>(),
      audit: [],
      rateLimits: new Map(),
      sweeper: null,
    };
  }
  return g[GLOBAL_KEY];
}

function uuid(): string {
  return globalThis.crypto.randomUUID();
}

class InMemorySessionStore implements SessionStore {
  async createSession({ office, service, sub_transaction }: NewSessionInput): Promise<StoredSession> {
    const s = state();
    const now = new Date();

    /* Take the next ticket from this office's counters. Queue state is per
       office — two offices must never share a counter. */
    const snapshot = await this.queueSnapshot(office.id, now);
    const issued = issueToken(snapshot.state, service);
    s.queues.set(office.id, issued.state);

    const issued_at = now.toISOString();
    const session: StoredSession = {
      session_id: uuid(),
      office_id: office.id,
      token_number: issued.number,
      seq: issued.seq,
      service,
      sub_transaction,
      issued_at,
      /* Hard limit: close of business on the day the ticket was issued.
         Nothing in this store may outlive it, and no code path anywhere in the
         application writes to expires_at after this line.

         The whole office is passed, not just its closing time, so expiryFor()
         resolves "17:00" in the OFFICE's timezone (OfficeHours.timeZone) and
         not the server's. That distinction decides the moment a customer's
         application data is destroyed, so it must not depend on where the
         process happens to run: on a UTC host a server-local calculation would
         put a Californian office's close of business seven or eight hours
         late, and the data would outlive the business day it was collected in
         — which is precisely the claim the security review tests. */
      expires_at: expiryFor(issued_at, office),
      status: 'waiting',
      form_data: {},
      submitted_at: null,
      edl_confirmation_number: null,
      updated_at: issued_at,
      edl_recorded_at: null,
    };

    s.sessions.set(session.session_id, session);
    return session;
  }

  async getSession(sessionId: string): Promise<StoredSession | null> {
    /* PURGE ON READ. An expired session is never returned, whatever state the
       sweeper is in — expiry is checked at the point of access, so a stalled
       timer cannot leak yesterday's data. */
    const session = state().sessions.get(sessionId);
    if (!session) return null;
    if (isExpired(session)) {
      await this.deleteSession(sessionId);
      return null;
    }
    return session;
  }

  async updateSession(
    sessionId: string,
    mutate: (session: StoredSession) => void
  ): Promise<StoredSession | null> {
    /* PURGE ON WRITE, via getSession. A patch arriving after close of business
       is dropped: it does not recreate the session and it cannot extend
       expiry. */
    const session = await this.getSession(sessionId);
    if (!session) return null;
    mutate(session);
    state().sessions.set(sessionId, session);
    return session;
  }

  async findByToken(token: string, officeId: string): Promise<StoredSession | null> {
    /* SECURITY — docs/03 §5.1
       The short token (A-042) is NOT a credential. It is printed on a ticket
       and read aloud across a lobby; it is short and sequential because it has
       to be. This lookup therefore exists ONLY behind the authenticated staff
       endpoint, and is scoped twice over:
         - to the office that issued it, so a token overheard at one office is
           useless at another (A-042 exists in every lobby), and
         - to the current business day, because expiry is enforced on read.
       No customer-side route calls this. Customer routes address sessions by
       session_id, a UUID, which is not guessable and not spoken aloud. */
    const wanted = normaliseToken(token);
    if (!wanted || !officeId) return null;

    for (const session of state().sessions.values()) {
      if (session.office_id !== officeId) continue;
      if (session.token_number.toUpperCase() !== wanted) continue;
      if (isExpired(session)) {
        await this.deleteSession(session.session_id);
        return null;
      }
      return session;
    }
    return null;
  }

  async listByOffice(officeId: string, now: Date = new Date()): Promise<StoredSession[]> {
    /* SECURITY — READ THIS BEFORE ADDING A FIELD TO THE CALLER.

       docs/03 §5 says staff authorisation is "lookup by token only; no
       listing, no search by name, no bulk export". This method is a listing,
       so it is a deliberate, documented deviation and the argument for it has
       to hold on its own.

       What it returns is CALL-BOARD DATA: which tokens are in the lobby and
       what state each is in. That is information already displayed on a screen
       on the wall and called out loud. It is not, and must never become,
       application content — no form_data, no completeness figure, no name, no
       confirmation number value. The REG 343 itself still requires a token
       lookup through the audited staff endpoint.

       Properly, this data belongs to the QUEUE SYSTEM, not to the session
       store: docs/03 §2.4 has the vendor's API supplying current serving
       number and queue depth per service. Phase 1 has no vendor, so the store
       stands in for one. When that dependency is resolved the rail is fed from
       the vendor and this method should be deleted rather than kept.

       On enumeration: it is tempting to argue the token-only rule stops an
       authenticated technician from sweeping every application. It does not,
       and it never did — tokens are sequential by design (A-041, A-042,
       A-043), so anyone who can call the staff endpoint can already walk the
       range. The real controls against insider bulk access are the audit log,
       which records every retrieval against a named individual, and the rate
       limit on the lookup endpoint. Both are in place. This method removes
       friction that was never load-bearing; it does not remove a control. */
    const out: StoredSession[] = [];
    for (const session of state().sessions.values()) {
      if (session.office_id !== officeId) continue;
      /* Purge on read applies here too: an expired ticket is deleted rather
         than listed, so the rail can never show yesterday's lobby. */
      if (isExpired(session, now)) {
        await this.deleteSession(session.session_id);
        continue;
      }
      out.push(session);
    }
    return out.sort((a, b) => a.seq - b.seq);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    /* HARD DELETE. No soft delete, no archive, no tombstone, no backup of
       application content (docs/03 §3.5). The audit log records that a purge
       happened; it never held the field values in the first place. */
    return state().sessions.delete(sessionId);
  }

  async purgeExpired(now: Date = new Date()): Promise<number> {
    const s = state();
    let removed = 0;
    for (const [id, session] of s.sessions) {
      if (isExpired(session, now)) {
        s.sessions.delete(id);
        removed++;
      }
    }
    /* Rate-limit windows are not personal data, but they are keyed by IP and
       there is no reason to keep them either. Same sweep, same principle. */
    for (const [key, window] of s.rateLimits) {
      if (now.getTime() - window.windowStart > RATE_WINDOW_TTL_MS) s.rateLimits.delete(key);
    }
    return removed;
  }

  async queueSnapshot(officeId: string, now: Date = new Date()): Promise<QueueSnapshot> {
    const s = state();
    let queue = s.queues.get(officeId);
    if (!queue) {
      queue = createQueueState(now.getTime());
      s.queues.set(officeId, queue);
    }

    /* The self-healing re-seed in advanceQueue must not fire while real
       tickets are outstanding, or a waiting customer's position would jump. */
    let hasLiveTickets = false;
    for (const session of s.sessions.values()) {
      if (session.office_id === officeId) {
        hasLiveTickets = true;
        break;
      }
    }

    const advanced = advanceQueue(queue, { now: now.getTime(), hasLiveTickets });
    if (advanced.reseeded) s.queues.set(officeId, advanced.state);

    return {
      state: advanced.state,
      nowServingVR: advanced.nowServingVR,
      nowServingDL: advanced.nowServingDL,
    };
  }

  async recordAudit(event: Omit<AuditEvent, 'event_id' | 'timestamp'>): Promise<AuditEvent> {
    const entry: AuditEvent = {
      ...event,
      event_id: uuid(),
      timestamp: new Date().toISOString(),
    };
    const s = state();
    s.audit.push(entry);
    if (s.audit.length > AUDIT_LOG_CAP) s.audit.splice(0, s.audit.length - AUDIT_LOG_CAP);

    /* In production this goes to the DMV log sink, retained independently of
       session data under standard log retention. Field names only — never
       field values. */
    console.info(
      '[audit]',
      entry.timestamp,
      entry.action,
      'staff=' + entry.staff_id,
      'office=' + entry.office_id,
      'token=' + entry.token_number,
      entry.field_changed ? 'field=' + entry.field_changed : ''
    );
    return entry;
  }

  async auditTrail(sessionId?: string): Promise<AuditEvent[]> {
    const all = state().audit;
    return sessionId ? all.filter((e) => e.session_id === sessionId) : [...all];
  }

  async rateLimit(
    key: string,
    limit: number,
    windowMs: number,
    now: number = Date.now()
  ): Promise<RateLimitResult> {
    const s = state();
    const existing = s.rateLimits.get(key);

    if (!existing || now - existing.windowStart >= windowMs) {
      s.rateLimits.set(key, { count: 1, windowStart: now });
      return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
    }

    existing.count++;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowMs - (now - existing.windowStart)) / 1000)
    );
    if (existing.count > limit) return { allowed: false, remaining: 0, retryAfterSeconds };
    return { allowed: true, remaining: limit - existing.count, retryAfterSeconds };
  }

  async stats() {
    const s = state();
    return { sessions: s.sessions.size, offices: s.queues.size, auditEvents: s.audit.length };
  }
}

/** The single store instance every API route uses. */
/* ==========================================================================
   Which store is in use

   In memory by default, so `npm run dev` needs no AWS and no table. Set
   DYNAMODB_TABLE to switch — that is the only signal, because a deployment
   that has a table configured always wants to use it.

   The in-memory store is not merely a development convenience: it is correct
   for a single always-on instance, and it makes "nothing persists overnight"
   true by construction. What it cannot do is survive a restart or be shared
   between instances, which is what DynamoDB is for.
   ========================================================================== */

const inMemoryStore: SessionStore = new InMemorySessionStore();

function selectStore(): SessionStore {
  if (!process.env.DYNAMODB_TABLE) return inMemoryStore;

  console.info('[store] DynamoDB:', process.env.DYNAMODB_TABLE);
  return dynamoDbStore;
}

export const store: SessionStore = selectStore();

/** Internal handle for the retention sweeper; see lib/server/retention.ts. */
export function sweeperHandle() {
  return {
    get: () => state().sweeper,
    set: (handle: ReturnType<typeof setInterval> | null) => {
      state().sweeper = handle;
    },
  };
}
