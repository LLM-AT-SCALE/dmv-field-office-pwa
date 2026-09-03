'use client';

/* ==========================================================================
   S4 — the ticket.

   The number is the largest thing on the screen because it is the one thing
   held up across a counter. Everything else on this view answers "how long"
   and "what can I do while I wait".

   There is no visible heading: the subject of the screen is the number
   itself. So it opens with a screen-reader-only one, which is what the view
   change moves focus to — without it a screen reader is told nothing at all
   when the ticket is issued.
   ========================================================================== */

import { useTranslation } from '@/lib/i18n';
import { serviceName } from '@/lib/i18n';
import { code39SVG } from '@/lib/barcode';
import { completeness } from '@/lib/reg343';
import { Button } from '@/components/ui/button';
import { Barcode } from '@/components/patterns/barcode';
import { TokenDisplay } from '@/components/patterns/token-display';
import { formatTime } from './format';
import { QueueStatusBlock } from './queue-status';
import { ButtonStack, ViewHeading } from './view-chrome';
import type { LocalSession, QueueStatus } from './session';

type TicketViewProps = {
  session: LocalSession;
  queue: QueueStatus | null;
  onStartApplication: () => void;
  onLeave: () => void;
};

function TicketView({ session, queue, onStartApplication, onLeave }: TicketViewProps) {
  const { t, lang } = useTranslation();

  const started = Object.keys(session.form_data).length > 0;
  const pct = Math.round(completeness(session.form_data) * 100);

  return (
    <div className="grid gap-8">
      <ViewHeading srOnly>
        {t('ticket.label')}: {session.token_number}
      </ViewHeading>

      <div className="grid gap-4 rounded-card border border-border bg-card p-5">
        <TokenDisplay
          token={session.token_number}
          label={t('ticket.label')}
          barcode={
            <Barcode
              svg={code39SVG(session.token_number)}
              label={`${t('ticket.label')}: ${session.token_number}`}
            />
          }
          sub={`${serviceName(session.service, lang)} · ${t('ticket.issued', {
            time: formatTime(session.issued_at, lang),
          })}`}
        />
        <p className="text-center text-tiny text-pretty text-muted-foreground">
          {t('ticket.scanHint')}
          <br />
          {t('ticket.validUntil', { time: formatTime(session.expires_at, lang) })}
        </p>
      </div>

      <QueueStatusBlock
        queue={queue}
        extraRows={[{ term: t('ticket.yourNumber'), value: session.token_number }]}
      />

      {/* The wait is the point of the product: it is the only time the customer
          has to fill the form in without a technician waiting on them. */}
      <section className="grid gap-4 rounded-card border border-border bg-card p-5">
        <h3>{t('app.completeTitle')}</h3>
        <p className="text-small text-pretty text-muted-foreground">
          {session.service === 'VR' ? (
            <>
              {t('app.reg343Intro')}{' '}
              {started ? t('app.progressPct', { pct }) : t('app.timeEstimate')}
            </>
          ) : (
            t('app.dlIntro')
          )}
        </p>
        <Button variant="accent" onClick={onStartApplication} className="w-full">
          {session.service === 'VR'
            ? started
              ? t('app.continue')
              : t('app.start')
            : t('app.dlContinue')}
        </Button>
      </section>

      <ButtonStack>
        <Button variant="ghost" size="sm" onClick={onLeave}>
          {t('ticket.leave')}
        </Button>
      </ButtonStack>
    </div>
  );
}

export { TicketView };
