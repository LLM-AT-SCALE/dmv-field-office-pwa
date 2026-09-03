'use client';

/* ==========================================================================
   S2 — Which service, then which transaction. Two steps on one screen: the
   second appears once the first is answered, so nobody is asked to choose a
   sub-transaction for a service they have not picked.
   ========================================================================== */

import { useTranslation } from '@/lib/i18n';
import { serviceBlurb, serviceName, subLabel } from '@/lib/i18n';
import { SERVICES } from '@/lib/office';
import { formatMinutes } from '@/lib/queue';
import type { ServiceCode } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupField } from '@/components/ui/radio-group';
import { ServiceTile } from '@/components/patterns/service-tile';
import { SectionHead } from './view-chrome';
import type { ServiceWaitView } from './session';

const SERVICE_ORDER: ServiceCode[] = ['VR', 'DL'];

type ServiceViewProps = {
  waits: Record<ServiceCode, ServiceWaitView>;
  service: ServiceCode | null;
  sub: string | null;
  onSelectService: (service: ServiceCode) => void;
  onSelectSub: (sub: string) => void;
  onContinue: () => void;
  onAsk: (question: string) => void;
};

function ServiceView({
  waits,
  service,
  sub,
  onSelectService,
  onSelectSub,
  onContinue,
  onAsk,
}: ServiceViewProps) {
  const { t, lang } = useTranslation();

  return (
    <div className="grid gap-8">
      <SectionHead eyebrow={t('service.step1')} heading={t('service.heading')} />

      <div className="grid gap-4">
        {SERVICE_ORDER.map((code) => (
          <ServiceTile
            key={code}
            title={serviceName(code, lang)}
            blurb={serviceBlurb(code, lang)}
            accent={service === code ? 'gold' : 'primary'}
            aria-pressed={service === code}
            onClick={() => onSelectService(code)}
            meta={
              <>
                <span>
                  {t('service.wait')}{' '}
                  <b className="text-foreground">{formatMinutes(waits[code].waitMinutes)}</b>
                </span>
                <span>
                  <b className="text-foreground">{waits[code].depth}</b> {t('service.inQueue')}
                </span>
              </>
            }
          />
        ))}
      </div>

      <Button variant="ghost" size="sm" onClick={() => onAsk(t('service.notSureQ'))}>
        {t('service.notSure')}
      </Button>

      {service ? (
        <div className="grid gap-6">
          <SectionHead eyebrow={t('service.step2')} eyebrowAccent heading={t('service.heading2')} />

          <RadioGroup
            value={sub ?? ''}
            onValueChange={onSelectSub}
            aria-label={t('service.heading2')}
            className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card"
          >
            {SERVICES[service].subs.map((option) => (
              <RadioGroupField
                key={option.id}
                value={option.id}
                label={subLabel(service, option.id, lang)}
                className="px-5 py-3"
              />
            ))}
          </RadioGroup>

          <Button variant="accent" disabled={!sub} onClick={onContinue} className="w-full">
            {t('service.continue')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export { ServiceView };
