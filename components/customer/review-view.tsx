'use client';

/* ==========================================================================
   Review — check your answers.

   Everything on this screen is advisory. Format problems and unanswered
   questions are both listed, and neither disables the submit button: an
   incomplete application on the technician's screen still saves most of the
   counter time, and the customer may simply not have the document with them.

   Values are shown in the customer's language, but only shown — form data
   still holds the English option strings the PDF is filled from.
   ========================================================================== */

import { useTranslation } from '@/lib/i18n';
import {
  fieldLabel,
  optionLabel,
  problemFieldLabel,
  sectionTitle,
  validationMessage,
  type Lang,
} from '@/lib/i18n';
import {
  completeness,
  formatProblems,
  missingRequired,
  visibleFields,
  visibleSections,
  type FieldDef,
} from '@/lib/reg343';
import type { FieldValue, FormData as Reg343Data } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/patterns/notice';
import { StatTile } from '@/components/patterns/stat-tile';
import { formatMoney } from './format';
import { ButtonStack, SectionHead, StatStrip } from './view-chrome';

/** What the customer sees. The stored value is untouched. */
function displayValue(field: FieldDef, value: FieldValue, lang: Lang): string {
  if (field.type === 'checkbox') return optionLabel(field, value ? 'Yes' : 'No', lang);
  if (field.type === 'currency') return `$${formatMoney(String(value), lang)}`;
  if (field.options) return optionLabel(field, String(value), lang);
  return String(value);
}

function isEmpty(value: FieldValue): boolean {
  return value === undefined || value === null || String(value).trim() === '';
}

type ReviewViewProps = {
  data: Reg343Data;
  busy: boolean;
  /** Set when the submit itself failed. Localized by the caller. */
  error: { title: string; body: string } | null;
  onSubmit: () => void;
  onKeepEditing: () => void;
};

function ReviewView({ data, busy, error, onSubmit, onKeepEditing }: ReviewViewProps) {
  const { t, lang } = useTranslation();

  const missing = missingRequired(data);
  const problems = formatProblems(data);
  const pct = Math.round(completeness(data) * 100);

  return (
    <div className="grid gap-8">
      <SectionHead eyebrow={t('review.eyebrow')} heading={t('review.heading')} />

      <StatStrip>
        <StatTile value={`${pct}%`} label={t('review.complete')} />
        <StatTile value={missing.length} label={t('review.toAnswer')} />
      </StatStrip>

      {problems.length ? (
        <Notice
          variant="warn"
          title={
            problems.length === 1
              ? t('review.problemsTitle1')
              : t('review.problemsTitle', { n: problems.length })
          }
        >
          <ul className="grid gap-1">
            {problems.map((problem) => (
              <li key={problem.id}>
                {problemFieldLabel(problem, lang)}:{' '}
                {validationMessage(problem.problem, lang)}
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {missing.length ? (
        <Notice
          variant="warn"
          title={
            missing.length === 1
              ? t('review.missingTitle1')
              : t('review.missingTitle', { n: missing.length })
          }
        >
          {t('review.missingBody')}
        </Notice>
      ) : (
        <Notice variant="success" title={t('review.allAnswered')}>
          {t('review.allAnsweredBody')}
        </Notice>
      )}

      {/* The signature is wet, at the counter, under penalty of perjury —
          saying so here stops the customer expecting to be finished. */}
      <Notice variant="info" title={t('review.signTitle')}>
        {t('review.signBody')}
      </Notice>

      {visibleSections(data).map((section) => {
        const rows = visibleFields(section, data)
          .map((field) => ({ field, value: data[field.id], empty: isEmpty(data[field.id]) }))
          .filter((row) => !row.empty || row.field.required);
        if (!rows.length) return null;

        return (
          <section key={section.id} className="grid gap-3">
            <h3>
              {section.num}. {sectionTitle(section, lang)}
            </h3>
            <dl className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card">
              {rows.map(({ field, value, empty }) => (
                <div
                  key={field.id}
                  className="flex flex-wrap items-baseline justify-between gap-4 px-5 py-3"
                >
                  <dt className="text-small text-muted-foreground">{fieldLabel(field, lang)}</dt>
                  <dd
                    className={cn(
                      'text-body text-right font-medium',
                      empty ? 'text-muted-foreground italic' : 'text-foreground',
                    )}
                  >
                    {empty ? t('review.notAnswered') : displayValue(field, value, lang)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}

      {/* Beside the button that failed, not at the top of a screen the
          customer has already scrolled past. Assertive because it contradicts
          what they just did. */}
      {error ? (
        <Notice variant="destructive" live="assertive" title={error.title}>
          {error.body}
        </Notice>
      ) : null}

      <ButtonStack>
        <Button variant="accent" onClick={onSubmit} disabled={busy}>
          {t('review.submit')}
        </Button>
        <Button variant="ghost" onClick={onKeepEditing}>
          {t('review.keepEditing')}
        </Button>
      </ButtonStack>
    </div>
  );
}

export { ReviewView };
