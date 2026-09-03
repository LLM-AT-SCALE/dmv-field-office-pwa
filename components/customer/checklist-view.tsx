'use client';

/* ==========================================================================
   S3 — Document checklist.

   Deliberately placed BEFORE the queue rather than after it. A missing
   document discovered at the counter after a fifty-minute wait costs a second
   trip; discovered here it costs a phone call to whoever is at home. The
   customer can still take a ticket either way — the list informs, it does not
   gate.
   ========================================================================== */

import { useTranslation } from '@/lib/i18n';
/* Aliased deliberately: lib/office exports a checklistFor(service, sub) that
   is English-only, and this is the other one — checklistFor(key, lang), which
   translates. Importing the wrong one shows a Spanish reader an English list
   and nothing looks broken. */
import { checklistFor as localizedChecklist, subLabel } from '@/lib/i18n';
import type { ServiceCode } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { CheckboxField } from '@/components/ui/checkbox';
import { Notice } from '@/components/patterns/notice';
import { ButtonStack, SectionHead } from './view-chrome';

type ChecklistViewProps = {
  service: ServiceCode;
  sub: string;
  busy: boolean;
  onTakeTicket: () => void;
  onAsk: (question: string) => void;
};

function ChecklistView({ service, sub, busy, onTakeTicket, onAsk }: ChecklistViewProps) {
  const { t, lang } = useTranslation();
  const items = localizedChecklist(`${service}:${sub}`, lang);

  return (
    <div className="grid gap-8">
      <SectionHead
        eyebrow={t('checklist.eyebrow')}
        heading={subLabel(service, sub, lang)}
        note={t('checklist.lede')}
      />

      <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card">
        {items.map((item) => (
          <li key={item.t} className="px-5">
            <CheckboxField label={item.t} description={item.h} />
          </li>
        ))}
      </ul>

      <Notice variant="info" title={t('checklist.feesTitle')}>
        {t('checklist.feesBody')}
      </Notice>

      <ButtonStack>
        <Button variant="accent" onClick={onTakeTicket} disabled={busy}>
          {t('checklist.cta')}
        </Button>
        <Button variant="ghost" onClick={() => onAsk(t('checklist.missingQ'))}>
          {t('checklist.missing')}
        </Button>
      </ButtonStack>
    </div>
  );
}

export { ChecklistView };
