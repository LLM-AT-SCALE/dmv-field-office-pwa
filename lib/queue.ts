/* ==========================================================================
   Queue maths — pure functions.

   Ported from the demo queue simulation in legacy-demo/js/store.js. The
   arithmetic is unchanged; what has gone is the storage. Every function takes
   the queue state in and returns a value (or a new state) out, so the same
   code serves a server render and a client tick, and two offices can never
   share a counter by accident — that is now the caller's key, not a global.
   ========================================================================== */

import { SERVICES } from './office';
import type { QueueState, ServiceCode, Session } from './types';

export type { QueueState } from './types';

/* Demo pacing: seconds of real time per customer served. */
export const TICK_SECONDS = { fast: 4, normal: 12, slow: 60 } as const;

export const DEFAULT_TICK_SECONDS = TICK_SECONDS.normal;

/* Minutes per customer at the counter, mocked. */
export const MINUTES_PER_PERSON: Record<ServiceCode, number> = { VR: 3, DL: 4 };

/* Append ?fast to the URL for a rapid demo, ?slow for a realistic one. */
export function tickSecondsFromParams(params: URLSearchParams): number {
  return params.has('fast') ? TICK_SECONDS.fast
    : params.has('slow') ? TICK_SECONDS.slow
      : DEFAULT_TICK_SECONDS;
}

/* The counters a demo starts from: a few people already ahead in each queue. */
export function createQueueState(
  now: number = Date.now(),
  tickSeconds: number = DEFAULT_TICK_SECONDS
): QueueState {
  return { base: now, tick: tickSeconds, servingVR: 38, servingDL: 15, nextVR: 42, nextDL: 19 };
}

/* Where the counters have reached, projected forward from the last seed.
   DL windows work through their queue more slowly than VR ones. */
export function nowServing(state: QueueState, now: number = Date.now()): { VR: number; DL: number } {
  const tickSeconds = state.tick || DEFAULT_TICK_SECONDS;
  const elapsedTicks = Math.floor((now - state.base) / (tickSeconds * 1000));
  return {
    VR: state.servingVR + elapsedTicks,
    DL: state.servingDL + Math.floor(elapsedTicks * 0.7)
  };
}

export interface AdvanceOptions {
  now?: number;
  /* Whether any ticket is currently live. Defaults to false, which is the
     legacy behaviour: with nothing in the store, the queue self-heals. */
  hasLiveTickets?: boolean;
}

export interface AdvancedQueue {
  /* The state to persist — a new object when the counters were re-seeded, the
     one passed in otherwise. */
  state: QueueState;
  nowServingVR: number;
  nowServingDL: number;
  reseeded: boolean;
}

/* Project the counters forward, re-seeding if they have caught up.

   Self-healing: a demo left running must never present an empty queue. When
   the counters catch up, re-seed so a few people are always ahead. */
export function advanceQueue(state: QueueState, options: AdvanceOptions = {}): AdvancedQueue {
  const now = options.now ?? Date.now();
  const hasLiveTickets = options.hasLiveTickets ?? false;

  const serving = nowServing(state, now);
  let servingVR = serving.VR;
  let servingDL = serving.DL;

  if (!hasLiveTickets && (servingVR >= state.nextVR - 1 || servingDL >= state.nextDL - 1)) {
    const next: QueueState = { ...state };
    next.servingVR = Math.max(servingVR, next.nextVR - 4);
    next.servingDL = Math.max(servingDL, next.nextDL - 3);
    next.nextVR = Math.max(next.nextVR, next.servingVR + 4);
    next.nextDL = Math.max(next.nextDL, next.servingDL + 3);
    next.base = now;
    servingVR = next.servingVR;
    servingDL = next.servingDL;
    return { state: next, nowServingVR: servingVR, nowServingDL: servingDL, reseeded: true };
  }

  return { state, nowServingVR: servingVR, nowServingDL: servingDL, reseeded: false };
}

/* 'A-042' — the prefix is the service's, the sequence is zero-padded to 3. */
export function tokenNumber(service: ServiceCode, seq: number): string {
  return SERVICES[service].prefix + '-' + String(seq).padStart(3, '0');
}

export interface IssuedToken {
  /* The state to persist, with the next sequence number consumed. */
  state: QueueState;
  seq: number;
  number: string;
}

/* Take the next ticket for a service. Returns a new state; the caller stores it. */
export function issueToken(state: QueueState, service: ServiceCode): IssuedToken {
  const seq = service === 'VR' ? state.nextVR : state.nextDL;
  const next: QueueState = { ...state };
  if (service === 'VR') next.nextVR = seq + 1; else next.nextDL = seq + 1;
  return { state: next, seq, number: tokenNumber(service, seq) };
}

export interface QueuePosition {
  /* People ahead of this ticket; 0 means it is being called. */
  position: number;
  /* The token currently at the counter, e.g. 'A-039'. */
  nowServing: string;
  waitMinutes: number;
  called: boolean;
  /* Close enough that the customer should stop what they are doing. */
  near: boolean;
}

/* Where one ticket stands. Pass the state returned by advanceQueue() if you
   want the self-healing demo behaviour; this function only reads. */
export function queueFor(
  state: QueueState,
  session: Pick<Session, 'service' | 'seq'>,
  now: number = Date.now()
): QueuePosition {
  const serving = nowServing(state, now);
  const current = session.service === 'VR' ? serving.VR : serving.DL;
  const position = Math.max(0, session.seq - current);
  const perPerson = MINUTES_PER_PERSON[session.service];
  return {
    position,
    nowServing: tokenNumber(session.service, current),
    waitMinutes: position * perPerson,
    called: position === 0,
    near: position > 0 && position <= 2
  };
}

export interface ServiceWait {
  /* How many people are waiting. */
  depth: number;
  minutes: number;
}

/* Queue depth and wait for both services — the lobby-level view. */
export function officeWaits(
  state: QueueState,
  now: number = Date.now()
): Record<ServiceCode, ServiceWait> {
  const serving = nowServing(state, now);
  const vrDepth = Math.max(0, state.nextVR - serving.VR);
  const dlDepth = Math.max(0, state.nextDL - serving.DL);
  return {
    VR: { depth: vrDepth, minutes: vrDepth * MINUTES_PER_PERSON.VR },
    DL: { depth: dlDepth, minutes: dlDepth * MINUTES_PER_PERSON.DL }
  };
}

export function formatMinutes(m: number): string {
  if (m <= 0) return 'now';
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/* A barcode scanner behaves like a keyboard. Some models transmit the Code 39
   start/stop asterisks along with the value, so strip them, along with any
   stray whitespace, before matching. */
export function normaliseToken(token: string): string {
  return String(token || '').trim().toUpperCase().replace(/^\*+|\*+$/g, '').trim();
}

export function findByToken(sessions: Session[], token: string): Session | null {
  const t = normaliseToken(token);
  return sessions.find(s => s.token_number.toUpperCase() === t) || null;
}
