'use client';

/* ==========================================================================
   S5-VR — REG 343, one section at a time.

   Three rules this screen exists to keep:

   1. VALIDATION IS ADVISORY, AND IT RUNS ON BLUR. Nothing here can stop a
      customer reaching the next section. Someone standing in a queue on a
      borrowed phone, blocked by a form, abandons it — and an abandoned form
      is worse for the technician than a form with a mistyped VIN in it. The
      message appears when they leave the field, never on the third character
      of a seventeen-character number.

   2. OPTION VALUES ARE ENGLISH. Every radio and select writes the English
      option string into form data — 'Auto', 'Gasoline' — and translates only
      what is painted. REG 343 is an English legal document and the PDF fill
      matches on those exact strings, so a Spanish speaker choosing
      "Automóvil" must still store 'Auto'. Nothing in the interface would look
      wrong if this were broken; the filing would simply be invalid.

   3. CONDITIONAL FIELDS ARE DERIVED, NOT TOGGLED. visibleSections and
      visibleFields are read on every render, so the motorcycle engine number,
      the commercial weight questions and the whole out-of-state section
      appear and disappear as answers change, with no separate bookkeeping to
      fall out of step.
   ========================================================================== */

import * as React from 'react';

import { useTranslation } from '@/lib/i18n';
import {
  advisoryText,
  fieldHint,
  fieldLabel,
  optionLabel,
  sectionNote,
  sectionTitle,
  supplementaryTitle,
  type Lang,
} from '@/lib/i18n';
import {
  triggeredAdvisories,
  triggeredForms,
  visibleFields,
  visibleSections,
  type FieldDef,
} from '@/lib/reg343';
import type { FieldValue, FormData as Reg343Data, Reg343FieldId } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CheckboxField } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupField } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Notice } from '@/components/patterns/notice';
import { SectionHead } from './view-chrome';

/* The paper form has nine sections; section 9 is the signature, which is wet
   and happens at the counter, so it is not in the schema. The eyebrow counts
   against the paper form because that is what the technician will be holding. */
const REG343_SECTION_COUNT = 9;

type FieldProps = {
  field: FieldDef;
  value: FieldValue;
  /** Already localized. Advisory — it never blocks anything. */
  error: string | null;
  lang: Lang;
  onChange: (id: Reg343FieldId, value: FieldValue) => void;
  onBlur: (id: Reg343FieldId) => void;
};

/** Label, hint and message wrapper shared by every control shape. */
function FieldFrame({
  field,
  error,
  lang,
  htmlFor,
  legend,
  children,
}: {
  field: FieldDef;
  error: string | null;
  lang: Lang;
  htmlFor?: string;
  /** Renders the label as a <legend>, for grouped controls. */
  legend?: boolean;
  children: React.ReactNode;
}) {
  const hint = fieldHint(field, lang);
  const label = (
    <>
      {fieldLabel(field, lang)}
      {field.required ? (
        <span aria-hidden="true" className="text-destructive">
          *
        </span>
      ) : null}
    </>
  );

  const body = (
    <>
      {legend ? (
        <legend className="text-body font-medium text-foreground">{label}</legend>
      ) : (
        <Label htmlFor={htmlFor}>{label}</Label>
      )}
      {hint ? (
        <p id={`${field.id}-hint`} className="text-small text-pretty text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${field.id}-error`} className="text-small text-destructive">
          {error}
        </p>
      ) : null}
    </>
  );

  const className = cn('grid content-start gap-2', field.half ? 'sm:col-span-1' : 'sm:col-span-2');

  return legend ? (
    <fieldset className={className}>{body}</fieldset>
  ) : (
    <div className={className}>{body}</div>
  );
}

function describedBy(field: FieldDef, lang: Lang, error: string | null): string | undefined {
  const ids = [
    fieldHint(field, lang) ? `${field.id}-hint` : null,
    error ? `${field.id}-error` : null,
  ].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

/* Native input types, plus the keyboards a phone should offer for them. */
const INPUT_TYPES: Record<string, React.HTMLInputTypeAttribute> = {
  number: 'number',
  date: 'date',
  tel: 'tel',
  currency: 'text',
};

function Field({ field, value, error, lang, onChange, onBlur }: FieldProps) {
  const described = describedBy(field, lang, error);
  const invalid = error ? true : undefined;

  if (field.type === 'radio') {
    return (
      <FieldFrame field={field} error={error} lang={lang} legend>
        <RadioGroup
          value={value == null ? '' : String(value)}
          onValueChange={(next) => onChange(field.id, next)}
          aria-describedby={described}
          aria-invalid={invalid}
          aria-required={field.required || undefined}
          className={cn(
            field.inline
              ? 'flex flex-wrap gap-x-8 gap-y-1'
              : 'divide-y divide-border overflow-hidden rounded-card border border-border bg-card',
          )}
        >
          {(field.options ?? []).map((option) => (
            <RadioGroupField
              key={option}
              /* The ENGLISH option string is what is stored. */
              value={option}
              id={`${field.id}-${option.replace(/\W+/g, '-')}`}
              label={optionLabel(field, option, lang)}
              className={field.inline ? 'w-auto' : 'px-5 py-3'}
            />
          ))}
        </RadioGroup>
      </FieldFrame>
    );
  }

  if (field.type === 'checkbox') {
    /* The label belongs to the box itself here, so FieldFrame is bypassed —
       there is nothing to put above it. */
    return (
      <div className={cn('grid gap-2', field.half ? 'sm:col-span-1' : 'sm:col-span-2')}>
        <CheckboxField
          id={field.id}
          checked={value === true || value === 'true'}
          onCheckedChange={(checked) => onChange(field.id, checked === true)}
          label={fieldLabel(field, lang)}
          description={fieldHint(field, lang)}
        />
      </div>
    );
  }

  if (field.type === 'select') {
    const current = value == null || value === '' ? undefined : String(value);
    return (
      <FieldFrame field={field} error={error} lang={lang} htmlFor={field.id}>
        <Select value={current} onValueChange={(next) => onChange(field.id, next)}>
          <SelectTrigger
            id={field.id}
            aria-describedby={described}
            aria-invalid={invalid}
            aria-required={field.required || undefined}
          >
            {/* No dictionary entry exists for a "Select…" placeholder, and the
                field's own label is already translated — so it stands in. */}
            <SelectValue placeholder={fieldLabel(field, lang)} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {optionLabel(field, option, lang)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldFrame>
    );
  }

  if (field.type === 'textarea') {
    return (
      <FieldFrame field={field} error={error} lang={lang} htmlFor={field.id}>
        <Textarea
          id={field.id}
          name={field.id}
          value={value == null ? '' : String(value)}
          aria-describedby={described}
          aria-invalid={invalid}
          aria-required={field.required || undefined}
          onChange={(event) => onChange(field.id, event.target.value)}
          onBlur={() => onBlur(field.id)}
        />
      </FieldFrame>
    );
  }

  return (
    <FieldFrame field={field} error={error} lang={lang} htmlFor={field.id}>
      <Input
        id={field.id}
        name={field.id}
        type={INPUT_TYPES[field.type] ?? 'text'}
        value={value == null ? '' : String(value)}
        maxLength={field.max}
        inputMode={
          field.type === 'currency' ? 'decimal' : field.type === 'tel' ? 'tel' : undefined
        }
        placeholder={
          field.type === 'currency' ? '0.00' : field.type === 'tel' ? '(916) 555-0142' : undefined
        }
        autoCapitalize={field.id === 'vin' ? 'characters' : undefined}
        spellCheck={field.id === 'vin' ? false : undefined}
        aria-describedby={described}
        aria-invalid={invalid}
        aria-required={field.required || undefined}
        onChange={(event) => onChange(field.id, event.target.value)}
        onBlur={() => onBlur(field.id)}
      />
    </FieldFrame>
  );
}

type FormViewProps = {
  data: Reg343Data;
  /** Index into the CURRENTLY visible sections. */
  sectionIndex: number;
  /** Field id → localized message. Advisory, set on blur. */
  errors: Record<string, string | null>;
  /** True for a moment after an answer reaches the server. */
  saved: boolean;
  /** An answer is on the phone but has not reached the server. */
  unsaved: boolean;
  onChange: (id: Reg343FieldId, value: FieldValue) => void;
  onBlur: (id: Reg343FieldId) => void;
  onPrev: () => void;
  onNext: () => void;
  onAsk: (question: string) => void;
};

function FormView({
  data,
  sectionIndex,
  errors,
  saved,
  unsaved,
  onChange,
  onBlur,
  onPrev,
  onNext,
  onAsk,
}: FormViewProps) {
  const { t, lang } = useTranslation();

  const sections = visibleSections(data);
  const index = Math.min(Math.max(sectionIndex, 0), sections.length - 1);
  const section = sections[index];
  const fields = visibleFields(section, data);
  const forms = triggeredForms(data);
  const advisories = triggeredAdvisories(data);
  const note = sectionNote(section, lang);

  const position = t('form.section', { n: index + 1, total: sections.length });
  const first = index === 0;
  const last = index === sections.length - 1;

  return (
    <div className="grid gap-8">
      {/* The assistant lives HERE on this screen rather than as a floating
          button, which would sit on top of the sticky Next control below. */}
      <div className="sticky top-(--header-h) z-30 -mx-(--gutter) flex items-center gap-3 bg-background/90 px-(--gutter) py-3 backdrop-blur-sm">
        <span className="text-tiny whitespace-nowrap text-muted-foreground">{position}</span>
        <Progress
          value={Math.round((index / sections.length) * 100)}
          aria-label={position}
          className="flex-1"
        />
        {/* Never claim "Saved" while an answer is still only on the phone. A
            customer who believes their form is with us walks to the counter and
            finds it blank, having been told the opposite. */}
        {unsaved ? (
          <span className="text-tiny whitespace-nowrap text-warning" role="status">
            {t('form.unsaved')}
          </span>
        ) : (
          <span
            className={cn(
              'text-tiny whitespace-nowrap text-success transition-opacity duration-fast ease-brand',
              saved ? 'opacity-100' : 'opacity-0',
            )}
          >
            {t('form.saved')}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-haspopup="dialog"
          aria-label={t('form.help')}
          onClick={() => onAsk(t('form.helpQ'))}
        >
          <span aria-hidden="true" className="font-display font-bold">
            ?
          </span>
        </Button>
      </div>

      <SectionHead
        eyebrow={`REG 343 · ${t('form.section', { n: section.num, total: REG343_SECTION_COUNT })}`}
        heading={sectionTitle(section, lang)}
        note={note}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        {fields.map((field) => (
          <Field
            key={field.id}
            field={field}
            value={data[field.id]}
            error={errors[field.id] ?? null}
            lang={lang}
            onChange={onChange}
            onBlur={onBlur}
          />
        ))}
      </div>

      {/* Supplementary forms are surfaced while the customer can still act on
          them — a phone call home — instead of at the counter. */}
      {forms.map((form) => (
        <Notice
          key={form.form}
          variant="warn"
          live="polite"
          title={t('form.alsoNeed', { form: form.form })}
        >
          {t('form.alsoNeedBody', { title: supplementaryTitle(form.form, form.title, lang) })}
        </Notice>
      ))}

      {advisories.map((advisory) => (
        <Notice key={advisory.text} variant="info" live="polite" title={t('form.pleaseNote')}>
          {advisoryText(advisory.text, lang)}
        </Notice>
      ))}

      <div className="sticky bottom-0 z-20 -mx-(--gutter) flex gap-3 border-t border-border bg-background/90 px-(--gutter) py-4 backdrop-blur-sm">
        <Button variant="ghost" onClick={onPrev} className="flex-1">
          {first ? t('form.back') : t('form.previous')}
        </Button>
        <Button variant="accent" onClick={onNext} className="flex-1">
          {last ? t('form.review') : t('form.next')}
        </Button>
      </div>
    </div>
  );
}

export { FormView };
