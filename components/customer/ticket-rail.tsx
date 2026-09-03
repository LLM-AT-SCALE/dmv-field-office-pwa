'use client';

/* ==========================================================================
   The desktop and kiosk companion column: once a ticket exists it stays in
   view while the customer works through the form, so the number and the
   position are never more than a glance away.

   PageShell hides the rail below 1024px, where the ticket screen itself
   carries this information — which is why the rail is not rendered on the
   ticket screen at all.
   ========================================================================== */

import { useTranslation } from '@/lib/i18n';
import { serviceName } from '@/lib/i18n';
import { formatMinutes } from '@/lib/queue';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { LocalSession, QueueStatus } from './session';

type TicketRailProps = {
  session: LocalSession;
  queue: QueueStatus | null;
  onGoToTicket: () => void;
};

function TicketRail({ session, queue, onGoToTicket }: TicketRailProps) {
  const { t, lang } = useTranslation();
  const called = queue?.called ?? false;

  return (
    <div className="grid gap-4">
      <div
        className={cn(
          'grid gap-2 rounded-card border border-border bg-card p-5',
          /* Called is the one state worth interrupting a form for. */
          called && 'border-l-3 border-l-gold bg-elevated',
        )}
      >
        <span className="text-tiny tracking-wide text-muted-foreground uppercase">
          {t('ticket.label')}
        </span>
        <span className="font-display text-h2 leading-none text-deep tabular-nums">
          {session.token_number}
        </span>
        <span className="text-small text-muted-foreground">
          {serviceName(session.service, lang)}
        </span>
        <span className="text-small text-foreground">
          {queue
            ? called
              ? t('ticket.goCounter')
              : `${queue.position} ${t('ticket.ahead')}`
            : null}
        </span>
        {queue && !called ? (
          <span className="text-small text-muted-foreground">
            {formatMinutes(queue.waitMinutes)}
          </span>
        ) : null}
      </div>

      <div className="grid gap-2 rounded-card border border-border bg-card p-5">
        <span className="text-tiny tracking-wide text-muted-foreground uppercase">
          {t('ticket.nowServing')}
        </span>
        <span className="text-body text-foreground tabular-nums">{queue?.nowServing ?? '–'}</span>
      </div>

      <Button variant="ghost" size="sm" onClick={onGoToTicket} className="w-full">
        {t('dl.back')}
      </Button>
    </div>
  );
}

export { TicketRail };
