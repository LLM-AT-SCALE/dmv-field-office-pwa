'use client';

/* ==========================================================================
   The live half of the ticket screens: position, estimated wait, who is being
   served, and the one notice whose wording changes as the queue moves.

   Three states, because they ask for three different things:
     · waiting   — stay in the building
     · next-but-one — start making your way back
     · called    — go to the counter now
   ========================================================================== */

import type { ReactNode } from 'react';

import { useTranslation } from '@/lib/i18n';
import { formatMinutes } from '@/lib/queue';
import { Notice } from '@/components/patterns/notice';
import { StatTile } from '@/components/patterns/stat-tile';
import { DefinitionRows, StatStrip } from './view-chrome';
import type { QueueStatus } from './session';

/* Shown before the first poll answers. An em dash is honest; a zero is not. */
const UNKNOWN = '–';

type QueueStatusBlockProps = {
  queue: QueueStatus | null;
  /** Appended under "Now serving" — the ticket screen adds the token itself. */
  extraRows?: { term: ReactNode; value: ReactNode }[];
};

function QueueStatusBlock({ queue, extraRows = [] }: QueueStatusBlockProps) {
  const { t } = useTranslation();

  const position = queue ? (queue.called ? t('ticket.now') : String(queue.position)) : UNKNOWN;
  const wait = queue
    ? queue.called
      ? t('ticket.now').toLowerCase()
      : formatMinutes(queue.waitMinutes)
    : UNKNOWN;

  return (
    <>
      <StatStrip>
        <StatTile value={position} label={t('ticket.ahead')} />
        <StatTile value={wait} label={t('ticket.estimated')} />
      </StatStrip>

      <DefinitionRows
        rows={[
          { term: t('ticket.nowServing'), value: queue?.nowServing ?? UNKNOWN },
          ...extraRows,
        ]}
      />

      <QueueNotice queue={queue} />
    </>
  );
}

/** Announced politely: the transition from "waiting" to "called" is the one
    thing on this screen someone must not miss. */
function QueueNotice({ queue }: { queue: QueueStatus | null }) {
  const { t } = useTranslation();

  if (queue?.called) {
    return (
      <Notice variant="success" title={t('ticket.calledTitle')} live="polite">
        {t('ticket.calledBody')}
      </Notice>
    );
  }
  if (queue?.near) {
    return (
      <Notice variant="warn" title={t('ticket.nearTitle')} live="polite">
        {t('ticket.nearBody')}
      </Notice>
    );
  }
  return (
    <Notice variant="info" title={t('ticket.stayTitle')} live="polite">
      {t('ticket.stayBody')}
    </Notice>
  );
}

export { QueueStatusBlock };
