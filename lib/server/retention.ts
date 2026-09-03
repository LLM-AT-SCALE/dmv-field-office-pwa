/* ==========================================================================
   Retention and purge
   Architecture: docs/03 §3.5 · Client requirements §10.1 · docs/04 §5.1

   THE RULE
   --------
   A ticket and the application data attached to it live for one visit and no
   longer. They are hard-deleted on whichever comes FIRST:

     (a) the technician marking the transaction complete, or
     (b) close of business on the day the ticket was issued.

   There is no soft delete, no archive, and no backup of application content.

   WHY THIS IS LOAD-BEARING
   ------------------------
   Autosave writes to the server from the first keystroke, so personal data
   reaches the server for every started form — including every form a customer
   abandons halfway through and walks away from. Without an enforced purge, the
   product would quietly accumulate partial DMV applications from people who
   never even reached a counter. The purge is what keeps this a HANDOFF BUFFER
   rather than a RECORD SYSTEM, and it is the single most important argument in
   the security review (docs/03 §3.5).

   HOW IT IS ENFORCED — three independent mechanisms, deliberately redundant
   -----------------------------------------------------------------------
   1. PURGE ON READ    — await store.getSession() and await store.findByToken() check
                         expiry at the point of access and hard-delete before
                         returning. An expired session can never be read, even
                         if every timer in the process has stopped.
   2. PURGE ON WRITE   — await store.updateSession() goes through the same check, so
                         a late autosave PATCH cannot resurrect a record or
                         extend its life. Expiry is set once at issue and is
                         never touched again; there is no code path that
                         extends expires_at.
   3. PURGE ON A TIMER — sweep() below runs on an interval so abandoned drafts
                         are removed at close of business without waiting for
                         anyone to touch them again.

   Mechanisms 1 and 2 mean correctness does not depend on mechanism 3 running.
   Mechanism 3 means data does not sit in memory until someone happens to ask
   for it. A reviewer should check all three, and should note that expiry is
   immutable after issue.
   ========================================================================== */

import { store, sweeperHandle, type PurgeReason, type StoredSession } from '@/lib/server/store';

/** How often the sweeper runs. One minute is well inside any reasonable
    interpretation of "close of business"; the purge-on-read path covers the
    gap in any case. */
const SWEEP_INTERVAL_MS = 60_000;

/**
 * Starts the end-of-day sweeper. Idempotent and safe to call from every route
 * module — Next.js route handlers have no application-level startup hook, so
 * the sweeper is started lazily by whichever request arrives first.
 */
export function startRetentionSweeper(): void {
  const handle = sweeperHandle();
  if (handle.get()) return;

  const timer = setInterval(() => {
    void (async () => {
      const removed = await store.purgeExpired();
      if (removed > 0) {
        console.info('[retention] end-of-day purge removed', removed, 'session(s)');
      }
    })();
  }, SWEEP_INTERVAL_MS);

  /* Do not hold the process open for the sake of the sweeper. */
  if (typeof timer.unref === 'function') timer.unref();
  handle.set(timer);
}

/**
 * Reads a session, enforcing retention on the way through.
 *
 * Returns null both when the session never existed and when it has expired —
 * the caller cannot tell the difference, and neither can an attacker probing
 * session identifiers.
 */
export async function readLiveSession(sessionId: string): Promise<StoredSession | null> {
  startRetentionSweeper();
  if (!sessionId) return null;
  return await store.getSession(sessionId);
}

/**
 * Hard-deletes a session, its draft and its DL reference.
 *
 * The audit event is written BEFORE the delete, because it references the
 * session and the token. The audit log records that a purge occurred, by whom
 * and when; it has never held any field value, so nothing about the purged
 * application survives it (docs/03 §3.4).
 */
export async function purgeSession(
  session: StoredSession,
  reason: PurgeReason,
  staffId: string = 'system'
): Promise<void> {
  await store.recordAudit({
    session_id: session.session_id,
    token_number: session.token_number,
    office_id: session.office_id,
    staff_id: staffId,
    action: 'purge',
    field_changed: null,
  });

  await store.deleteSession(session.session_id);
  console.info(
    '[retention] hard-deleted session',
    session.session_id,
    'token',
    session.token_number,
    'reason',
    reason
  );
}

/** Runs a sweep immediately. Exposed for the route modules and for tests. */
export async function sweep(): Promise<number> {
  return await store.purgeExpired();
}
