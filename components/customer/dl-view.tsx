'use client';

/* ==========================================================================
   S5-DL — the driver licence hand-off.

   DMV will not let DL 44 be downloaded (every printed copy carries its own
   barcode), and it already publishes the form online. So this product does
   not rebuild it: it links out, and stores the confirmation number DMV emails
   back — one field, and the only driver licence data this application ever
   holds. The privacy notice at the foot of the screen says so plainly,
   because a customer being asked to leave the app deserves to know what is
   kept when they come back.
   ========================================================================== */

import * as React from 'react';

import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/patterns/notice';
import { SectionHead } from './view-chrome';
import type { LocalSession } from './session';

/* DMV's own online DL 44. */
const EDL_URL = 'https://www.edl.dmv.ca.gov/';

type DlViewProps = {
  session: LocalSession;
  busy: boolean;
  /** Set when the server refused the number; already localized. */
  error: string | null;
  onSave: (confirmationNumber: string) => void;
  onBack: () => void;
};

function DlView({ session, busy, error, onSave, onBack }: DlViewProps) {
  const { t } = useTranslation();
  const saved = session.edl_confirmation_number;
  const [value, setValue] = React.useState(saved ?? '');

  const errorId = error ? 'edl-conf-error' : undefined;

  return (
    <div className="grid gap-8">
      <SectionHead eyebrow={t('dl.eyebrow')} heading={t('dl.heading')} note={t('dl.body')} />

      <Notice variant="warn" title={t('dl.beforeTitle')}>
        {t('dl.beforeBody')}
      </Notice>

      <div className="grid gap-3">
        {/* A new tab, so the queue position on this one is not lost. */}
        <Button variant="accent" asChild className="w-full">
          <a href={EDL_URL} target="_blank" rel="noopener noreferrer">
            {t('dl.open')}
          </a>
        </Button>
        <p className="text-center text-tiny text-muted-foreground">{t('dl.newTab')}</p>
      </div>

      <section className="grid gap-4 rounded-card border border-border bg-card p-5">
        <div className="grid gap-2">
          <h3>{t('dl.confTitle')}</h3>
          <p className="text-small text-muted-foreground">{t('dl.confBody')}</p>
        </div>

        <div className="grid gap-2">
          <label htmlFor="edl-conf" className="sr-only">
            {t('dl.confLabel')}
          </label>
          <Input
            id="edl-conf"
            value={value}
            placeholder="4821-99KD"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            onChange={(event) => setValue(event.target.value)}
          />
          {error ? (
            <p id={errorId} className="text-small text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <Button onClick={() => onSave(value.trim())} disabled={busy || !value.trim()}>
          {saved ? t('dl.update') : t('dl.save')}
        </Button>

        {saved ? (
          <p className="text-tiny text-success">{t('dl.saved', { token: session.token_number })}</p>
        ) : null}
      </section>

      <Notice variant="info" title={t('dl.privacyTitle')}>
        {t('dl.privacyBody')}
      </Notice>

      <Button variant="ghost" onClick={onBack} className="w-full">
        {t('dl.back')}
      </Button>
    </div>
  );
}

export { DlView };
