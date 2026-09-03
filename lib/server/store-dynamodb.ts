/* ==========================================================================
   DynamoDB implementation of SessionStore

   Chosen over a relational store because the access pattern is key-value:
   fetch by session_id, fetch by token, list one office's live tickets. Nothing
   is joined, nothing is queried across records, and every row is deleted the
   same day. There is no schema to migrate and no connection pool to manage
   from a serverless runtime.

   ── Retention, and why TTL is not the mechanism ────────────────────────────

   DynamoDB's TTL is a BACKSTOP here, never the mechanism. AWS deletes expired
   items "typically within 48 hours", and this product promises the customer, on
   screen, that their details are deleted at close of business — and tells the
   technician the same thing in the record header. A 48-hour window would make
   both statements false.

   So deletion happens four ways, in order of authority:

     1. explicit DeleteItem when the technician completes a transaction
     2. purgeExpired(), run by the sweeper on its interval
     3. reads filter expired items, so one not yet collected is never returned
     4. TTL eventually removes whatever the first three missed

   Point 3 matters most for correctness: even if a purge has not run, an expired
   session is invisible. The data cannot outlive the promise from the outside,
   whatever the table happens to still hold internally.

   ── Table shape ────────────────────────────────────────────────────────────

     pk    partition key   SESSION#<session_id> | QUEUE#<office_id>
                           | AUDIT#<session_id> | RATE#<key>
     sk    sort key        the item kind, or an ordering key for audit events
     gsi1pk / gsi1sk       token lookup: TOKEN#<office_id> / <token_number>
     expires_epoch         TTL attribute, seconds since epoch

   One table, several item kinds. That is idiomatic for DynamoDB and keeps the
   whole visit — session, queue counters, audit trail — in one place with one
   set of permissions to reason about.
   ========================================================================== */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

import { expiryFor, isExpired } from '@/lib/office';
import { advanceQueue, createQueueState, issueToken } from '@/lib/queue';
import type { QueueState } from '@/lib/types';

import type {
  AuditEvent,
  NewSessionInput,
  QueueSnapshot,
  RateLimitResult,
  SessionStore,
  StoredSession,
} from './store';

const TABLE = process.env.DYNAMODB_TABLE ?? 'field-office-pwa';
const REGION = process.env.AWS_REGION ?? 'us-west-2';

/* The audit log outlives the end-of-day purge deliberately (docs/03 §3.4), but
   not forever: it is retained under DMV's ordinary log policy. */
const AUDIT_TTL_DAYS = 30;

/* Rate-limit windows are transient by nature. */
const RATE_TTL_SECONDS = 3600;

/* Built on first use, not at import. A deployment running the in-memory store
   still imports this module through the store selector, and should not pay for
   an SDK client — or trigger credential resolution — it will never call. */
let docClient: DynamoDBDocumentClient | null = null;

function db(): DynamoDBDocumentClient {
  if (docClient) return docClient;
  docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
    marshallOptions: {
      /* An unanswered field is absent, not an empty string. Without this, every
         untouched field on a 79-field form would round-trip as "". */
      removeUndefinedValues: true,
    },
  });
  return docClient;
}

const epoch = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const uuid = () => globalThis.crypto.randomUUID();

/* ---- keys --------------------------------------------------------------- */

const sessionKey = (id: string) => ({ pk: `SESSION#${id}`, sk: 'SESSION' });
const queueKey = (officeId: string) => ({ pk: `QUEUE#${officeId}`, sk: 'QUEUE' });
const rateKey = (key: string) => ({ pk: `RATE#${key}`, sk: 'RATE' });

/* ---- item shapes -------------------------------------------------------- */

interface SessionItem extends StoredSession {
  pk: string;
  sk: string;
  gsi1pk: string;
  gsi1sk: string;
  expires_epoch: number;
}

function toItem(session: StoredSession): SessionItem {
  return {
    ...session,
    ...sessionKey(session.session_id),
    /* Token lookup is office-scoped by contract: a technician may reach exactly
       the one application whose token they were given, at their own office. The
       partition key encodes that, so the scoping is enforced by the key rather
       than by a filter someone could forget to apply. */
    gsi1pk: `TOKEN#${session.office_id}`,
    gsi1sk: session.token_number,
    expires_epoch: epoch(session.expires_at),
  };
}

function fromItem(item: Record<string, unknown> | undefined): StoredSession | null {
  if (!item) return null;
  /* The key and index attributes are storage detail and never leave this
     module — the rest of the application only knows about StoredSession.
     Listed explicitly rather than destructured-and-discarded so the set of
     storage-only attributes stays visible in one place. */
  const STORAGE_ONLY = ['pk', 'sk', 'gsi1pk', 'gsi1sk', 'expires_epoch'] as const;
  const session = { ...item } as Record<string, unknown>;
  for (const key of STORAGE_ONLY) delete session[key];
  return session as unknown as StoredSession;
}

/* An expired session is treated as absent everywhere, whether or not a purge
   has reached it yet. This is what keeps the retention promise true from the
   outside even though TTL collection is not prompt. */
function live(session: StoredSession | null, now: Date): StoredSession | null {
  if (!session) return null;
  return isExpired(session, now) ? null : session;
}

/* ---- the store ---------------------------------------------------------- */

class DynamoDbSessionStore implements SessionStore {
  async createSession(input: NewSessionInput): Promise<StoredSession> {
    const { office, service, sub_transaction } = input;
    const snapshot = await this.queueSnapshot(office.id);

    const issued = issueToken(snapshot.state, service);
    await this.putQueue(office.id, issued.state);

    const issuedAt = new Date().toISOString();
    /* The whole office is passed, not just a closing time, so this matches the
       in-memory store exactly — two stores computing retention differently is
       how a promise quietly stops being true. */
    const expiresAt = expiryFor(issuedAt, office);

    const session: StoredSession = {
      session_id: uuid(),
      office_id: office.id,
      token_number: issued.number,
      seq: issued.seq,
      service,
      sub_transaction,
      issued_at: issuedAt,
      expires_at: expiresAt,
      status: 'waiting',
      form_data: {},
      submitted_at: null,
      edl_confirmation_number: null,
      updated_at: issuedAt,
      edl_recorded_at: null,
    };

    await db().send(new PutCommand({ TableName: TABLE, Item: toItem(session) }));
    return session;
  }

  async getSession(sessionId: string): Promise<StoredSession | null> {
    const res = await db().send(
      new GetCommand({ TableName: TABLE, Key: sessionKey(sessionId) })
    );
    return live(fromItem(res.Item), new Date());
  }

  async updateSession(
    sessionId: string,
    mutate: (session: StoredSession) => void
  ): Promise<StoredSession | null> {
    const current = await this.getSession(sessionId);
    if (!current) return null;

    /* Read-modify-write rather than a field-level UpdateExpression. The mutate
       callback is the interface the routes already use, and DynamoDB bills an
       update on the size of the whole item regardless — so an expression would
       add complexity without saving anything. */
    mutate(current);
    current.updated_at = new Date().toISOString();

    await db().send(new PutCommand({ TableName: TABLE, Item: toItem(current) }));
    return current;
  }

  async findByToken(token: string, officeId: string): Promise<StoredSession | null> {
    const wanted = token.trim().toUpperCase().replace(/^\*+|\*+$/g, '').trim();
    if (!wanted) return null;

    const res = await db().send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: 'token-index',
        KeyConditionExpression: 'gsi1pk = :p AND gsi1sk = :t',
        ExpressionAttributeValues: { ':p': `TOKEN#${officeId}`, ':t': wanted },
        Limit: 1,
      })
    );
    return live(fromItem(res.Items?.[0]), new Date());
  }

  async listByOffice(officeId: string, now: Date = new Date()): Promise<StoredSession[]> {
    const res = await db().send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: 'token-index',
        KeyConditionExpression: 'gsi1pk = :p',
        ExpressionAttributeValues: { ':p': `TOKEN#${officeId}` },
      })
    );
    return (res.Items ?? [])
      .map((i) => fromItem(i))
      .filter((s): s is StoredSession => live(s, now) !== null)
      .sort((a, b) => a.seq - b.seq);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const res = await db().send(
      new DeleteCommand({
        TableName: TABLE,
        Key: sessionKey(sessionId),
        ReturnValues: 'ALL_OLD',
      })
    );
    return Boolean(res.Attributes);
  }

  async purgeExpired(now: Date = new Date()): Promise<number> {
    /* Every live office is scanned through the token index rather than the
       table, so this never reads audit or queue items. At the scale this runs
       at — a few hundred tickets per office per day — that is cheap, and it
       does not depend on TTL having collected anything. */
    const offices = await this.knownOffices();
    let removed = 0;

    for (const officeId of offices) {
      const res = await db().send(
        new QueryCommand({
          TableName: TABLE,
          IndexName: 'token-index',
          KeyConditionExpression: 'gsi1pk = :p',
          ExpressionAttributeValues: { ':p': `TOKEN#${officeId}` },
        })
      );
      for (const item of res.Items ?? []) {
        const session = fromItem(item);
        if (session && isExpired(session, now)) {
          await this.deleteSession(session.session_id);
          removed++;
        }
      }
    }

    if (removed > 0) {
      console.info('[retention] end-of-day purge removed', removed, 'session(s)');
    }
    return removed;
  }

  async queueSnapshot(officeId: string, now: Date = new Date()): Promise<QueueSnapshot> {
    const res = await db().send(
      new GetCommand({ TableName: TABLE, Key: queueKey(officeId) })
    );

    let state = (res.Item?.state as QueueState | undefined) ?? null;
    if (!state) {
      state = createQueueState();
      await this.putQueue(officeId, state);
    }

    const advanced = advanceQueue(state, { now: now.getTime() });
    if (advanced.reseeded) await this.putQueue(officeId, advanced.state);

    return {
      state: advanced.state,
      nowServingVR: advanced.nowServingVR,
      nowServingDL: advanced.nowServingDL,
    };
  }

  async recordAudit(
    event: Omit<AuditEvent, 'event_id' | 'timestamp'>
  ): Promise<AuditEvent> {
    const full: AuditEvent = {
      ...event,
      event_id: uuid(),
      timestamp: new Date().toISOString(),
    };
    await db().send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          ...full,
          pk: `AUDIT#${event.session_id}`,
          /* Sorted by time, so a session's trail reads in order. */
          sk: `${full.timestamp}#${full.event_id}`,
          expires_epoch: Math.floor(Date.now() / 1000) + AUDIT_TTL_DAYS * 86_400,
        },
      })
    );
    return full;
  }

  async auditTrail(sessionId?: string): Promise<AuditEvent[]> {
    /* Deliberately requires a session id. There is no "read the whole audit
       log" path, because that would be a way to enumerate customers — the same
       reason there is no listing endpoint for applications. */
    if (!sessionId) return [];
    const res = await db().send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'pk = :p',
        ExpressionAttributeValues: { ':p': `AUDIT#${sessionId}` },
      })
    );
    return (res.Items ?? []) as AuditEvent[];
  }

  async rateLimit(
    key: string,
    limit: number,
    windowMs: number,
    now: number = Date.now()
  ): Promise<RateLimitResult> {
    const windowStart = Math.floor(now / windowMs) * windowMs;
    try {
      const res = await db().send(
        new UpdateCommand({
          TableName: TABLE,
          Key: rateKey(`${key}#${windowStart}`),
          UpdateExpression: 'ADD #c :one SET expires_epoch = :ttl',
          ExpressionAttributeNames: { '#c': 'count' },
          ExpressionAttributeValues: {
            ':one': 1,
            ':ttl': Math.floor(now / 1000) + RATE_TTL_SECONDS,
          },
          ReturnValues: 'UPDATED_NEW',
        })
      );
      const count = Number(res.Attributes?.count ?? 1);
      const retryAfterSeconds = Math.ceil((windowStart + windowMs - now) / 1000);
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        retryAfterSeconds,
      };
    } catch {
      /* A rate limiter that fails closed would take the whole service down with
         it. Availability wins here: the limiter guards against accidental
         hammering, not against a determined attacker. */
      return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
    }
  }

  async stats(): Promise<{ sessions: number; offices: number; auditEvents: number }> {
    const offices = await this.knownOffices();
    let sessions = 0;
    for (const officeId of offices) sessions += (await this.listByOffice(officeId)).length;
    return { sessions, offices: offices.length, auditEvents: -1 };
  }

  /* ---- internals -------------------------------------------------------- */

  private async putQueue(officeId: string, state: QueueState): Promise<void> {
    await db().send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          ...queueKey(officeId),
          state,
          /* Queue counters outlive a single ticket but not the working day. */
          expires_epoch: Math.floor(Date.now() / 1000) + 2 * 86_400,
        },
      })
    );
  }

  /* The office registry is static configuration, so this asks it rather than
     scanning the table for distinct partitions. */
  private async knownOffices(): Promise<string[]> {
    const { OFFICES } = await import('@/lib/office');
    return Object.keys(OFFICES);
  }
}

export const dynamoDbStore: SessionStore = new DynamoDbSessionStore();

/** Exported for the table-creation script, so the name lives in one place. */
export const DYNAMODB_TABLE_NAME = TABLE;
export const DYNAMODB_TOKEN_INDEX = 'token-index';
