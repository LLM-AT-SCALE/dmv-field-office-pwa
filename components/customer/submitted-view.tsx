'use client';

/* ==========================================================================
   S6 — submitted.

   The same ticket, with the state that matters changed: the application is
   already on the technician's screen. The queue block stays, because the
   customer is still waiting and still needs to know when to walk over.

   Unanswered questions are named rather than hidden — the technician will
   fill them in at the counter, and saying how many stops the customer
   wondering whether something went wrong.
   ========================================================================== */

import { useTranslation } from '@/lib/i18n';
import { missingRequired } from '@/lib/reg343';
import { code39SVG } from '@/lib/barcode';
import { Button } from '@/components/ui/button';
import { Barcode } from '@/components/patterns/barcode';
import { Notice } from '@/components/patterns/notice';
import { TokenDisplay } from '@/components/patterns/token-display';
import { formatTime } from './format';
import { QueueStatusBlock } from './queue-status';
import { ButtonStack, ViewHeading } from './view-chrome';
import type { LocalSession, QueueStatus } from './session';

type SubmittedViewProps = {
  session: LocalSession;
  queue: QueueStatus | null;
  onViewAnswers: () => void;
  onLeave: () => void;
};

function SubmittedView({ session, queue, onViewAnswers, onLeave }: SubmittedViewProps) {
  const { t, lang } = useTranslation();
  /* REG 343 only. A DL session carries no form data, so counting its
     "unanswered" fields would tell a customer who has finished at
     edl.dmv.ca.gov that twenty questions are outstanding. */
  const missing = session.service === 'VR' ? missingRequired(session.form_data) : [];

  return (
    <div className="grid gap-8">
      <ViewHeading srOnly>
        {t('sent.label')}: {session.token_number}
      </ViewHeading>

      <div className="grid gap-4 rounded-card border border-border bg-card p-5">
        <TokenDisplay
          token={session.token_number}
          label={t('sent.label')}
          barcode={
            <Barcode
              svg={code39SVG(session.token_number)}
              label={`${t('ticket.label')}: ${session.token_number}`}
            />
          }
          sub={t('sent.at', { time: formatTime(session.submitted_at, lang) })}
        />
      </div>

      <Notice variant="success" title={t('sent.title')}>
        {t('sent.body', { token: session.token_number })}{' '}
        {missing.length === 0
          ? null
          : missing.length === 1
            ? t('sent.remaining1')
            : t('sent.remaining', { n: missing.length })}
      </Notice>

      <QueueStatusBlock queue={queue} />

      <ButtonStack>
        <Button variant="ghost" onClick={onViewAnswers}>
          {t('sent.viewAnswers')}
        </Button>
        <Button variant="ghost" size="sm" onClick={onLeave}>
          {t('ticket.leave')}
        </Button>
      </ButtonStack>
    </div>
  );
}

export { SubmittedView };
