'use client';

/* ==========================================================================
   S1 — Welcome. The first thing anyone sees, arriving from a QR poster, a
   short URL, an appointment email or lobby signage. It has to answer three
   questions before it asks for anything: where am I, how long is the wait,
   and where do I stand.
   ========================================================================== */

import { useTranslation } from '@/lib/i18n';
import { hoursToday, layoutLines, serviceName } from '@/lib/i18n';
import { formatMinutes } from '@/lib/queue';
import { resolveOffice } from '@/lib/office';
import type { Office, ServiceCode } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/patterns/notice';
import { StatTile } from '@/components/patterns/stat-tile';
import { DefinitionRows, StatStrip, ViewHeading } from './view-chrome';
import type { ServiceWaitView } from './session';

const SERVICE_ORDER: ServiceCode[] = ['VR', 'DL'];

type WelcomeViewProps = {
  office: Office;
  waits: Record<ServiceCode, ServiceWaitView>;
  /**
   * Whether the office is open right now, from its own published hours
   * (fetchOfficeSnapshot returns it as `isOpen`).
   *
   * Undefined means NOT YET KNOWN, and the status row is then omitted rather
   * than guessed. This screen is read by someone deciding whether to get in
   * the car, so "Open now" printed in green over a closed office is the one
   * wrong answer that actually wastes a journey — saying nothing is worse
   * copy and better information.
   */
  isOpen?: boolean;
  /**
   * A ticket held at a DIFFERENT office than the one just scanned.
   *
   * Scanning a second office's poster used to restore the first office's ticket
   * and drop the customer back where they left off — at the wrong building. The
   * ticket is surfaced rather than silently discarded, because it may be a live
   * place in a real queue that someone is still waiting in.
   */
  otherOfficeTicket?: { token_number: string; office_id: string } | null;
  onDiscardOtherTicket?: () => void;
  onStart: () => void;
};

function WelcomeView({
  office,
  waits,
  isOpen,
  otherOfficeTicket,
  onDiscardOtherTicket,
  onStart,
}: WelcomeViewProps) {
  const { t, lang } = useTranslation();

  const otherOffice = otherOfficeTicket ? resolveOffice(otherOfficeTicket.office_id) : null;

  return (
    <div className="grid gap-8" data-stagger>
      {otherOfficeTicket && otherOffice ? (
        <Notice variant="warn" title={t('welcome.otherTicketTitle')}>
          <p>
            {t('welcome.otherTicketBody', {
              token: otherOfficeTicket.token_number,
              office: otherOffice.name,
              here: office.name,
            })}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild variant="ghost" size="field">
              <a href={`/o/${otherOfficeTicket.office_id}`}>
                {t('welcome.otherTicketKeep', { token: otherOfficeTicket.token_number })}
              </a>
            </Button>
            <Button variant="ghost" size="field" onClick={onDiscardOtherTicket}>
              {t('welcome.otherTicketDrop')}
            </Button>
          </div>
        </Notice>
      ) : null}
      {/* resolveOffice() falls back to the default office rather than showing a
          broken page. Saying so is not optional: someone standing in Roseville
          must not read Folsom's wait times believing they are their own. */}
      {office.unresolved ? (
        <Notice variant="warn" title={t('welcome.unknownOffice')}>
          {t('welcome.unknownOfficeBody', { code: office.unresolved, office: office.name })}
        </Notice>
      ) : null}

      <div className="grid gap-4">
        <span className="text-tiny font-medium tracking-wide text-muted-foreground uppercase">
          {t('welcome.eyebrow')}
        </span>
        <ViewHeading level="h1">{office.name}</ViewHeading>
        <p className="text-prose text-pretty text-muted-foreground">{t('welcome.lede')}</p>
      </div>

      <StatStrip>
        {SERVICE_ORDER.map((code) => (
          <StatTile
            key={code}
            value={formatMinutes(waits[code].waitMinutes)}
            label={serviceName(code, lang)}
            hint={t('welcome.waiting', { n: waits[code].depth })}
          />
        ))}
      </StatStrip>

      <DefinitionRows
        rows={[
          { term: t('welcome.address'), value: office.address },
          { term: t('welcome.today'), value: hoursToday(office, lang) },
          ...(isOpen === undefined
            ? []
            : [
                {
                  term: t('welcome.status'),
                  value: isOpen ? t('welcome.open') : t('welcome.closed'),
                  tone: isOpen ? ('positive' as const) : ('caution' as const),
                },
              ]),
        ]}
      />

      <section className="grid gap-3 rounded-card border border-border bg-card p-5">
        <h3>{t('welcome.inside')}</h3>
        <ul className="grid list-disc gap-2 pl-5 text-small text-muted-foreground">
          {layoutLines(office, lang).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <Button variant="accent" onClick={onStart} className="w-full">
        {t('welcome.cta')}
      </Button>
    </div>
  );
}

export { WelcomeView };
