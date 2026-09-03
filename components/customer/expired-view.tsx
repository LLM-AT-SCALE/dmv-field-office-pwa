'use client';

/* ==========================================================================
   The expired ticket.

   Reached two ways: the local mirror is past its expiry, or the API answers
   'gone' for a session id. Both mean the same thing to the customer, and the
   screen says the one thing they will want to know before they ask — that
   nothing they typed has been kept.
   ========================================================================== */

import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/patterns/notice';
import { SectionHead } from './view-chrome';

function ExpiredView({ onRestart }: { onRestart: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-8">
      <SectionHead eyebrow={t('expired.eyebrow')} heading={t('expired.heading')} />

      <Notice variant="info" title={t('expired.title')}>
        {t('expired.body')}
      </Notice>

      <p className="text-small text-pretty text-muted-foreground">{t('expired.next')}</p>

      <Button variant="accent" onClick={onRestart} className="w-full">
        {t('expired.restart')}
      </Button>
    </div>
  );
}

export { ExpiredView };
