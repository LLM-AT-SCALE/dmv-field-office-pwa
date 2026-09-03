/* ==========================================================================
   REG 343 format validation — client requirements §6

   Checks what the customer types, with no connection to any DMV system.
   Record validation (is the plate real, is it theirs) is Phase 2.

   Every rule is ADVISORY. It tells the customer something looks wrong; it
   never blocks them. A form that refuses to move on, held by someone standing
   in a queue on a borrowed phone, gets abandoned — which is a worse outcome
   than a field the technician has to correct.

   Ported from legacy-demo/js/form-reg343.js. The English sentences are the
   verified wording — do not reword them.

   A validator returns a STRUCTURED problem rather than a sentence, because
   these messages have to be readable in Spanish (a legal requirement here, not
   a nicety) and a translation cannot be recovered from English prose by
   pattern-matching it. Every problem carries:

     id      a stable key the translation is looked up by
     params  the interpolated values, kept SEPARATE from the text — Spanish
             puts them in a different place in the sentence, so a pre-formatted
             string cannot be translated correctly
     en      today's exact English sentence, so nothing is stranded while the
             interface catches up

   The object is truthy, so `if (msg)` checks read the same as they always did.
   ========================================================================== */

import type { FormData } from '../types';

/* Every message this module can produce. Exported as a union so a translation
   table can be declared `Record<ValidationMessageId, string>` and a missing or
   misspelled key becomes a compile error rather than an English sentence
   appearing in the middle of a Spanish form. */
import { isCaliforniaPlace } from './ca-places';

export const VALIDATION_MESSAGE_IDS = [
  'vin.length',
  'vin.forbiddenLetters',
  'vin.alphanumeric',
  'plate.length',
  'plate.alphanumeric',
  'driverLicense.format',
  'zip.format',
  'zip.notCalifornia',
  'address.poBox',
  'address.short',
  'address.noNumber',
  'city.short',
  'city.digits',
  'city.unknownCalifornia',
  'phone.length',
  'yearModel.range',
  'odometer.wholeNumber',
  'currency.format',
  'date.notFuture'
] as const;

export type ValidationMessageId = (typeof VALIDATION_MESSAGE_IDS)[number];

export interface ValidationProblem {
  id: ValidationMessageId;
  /* Values interpolated into the sentence, never baked into `en`'s replacement. */
  params?: Record<string, string | number>;
  /* The English sentence, already interpolated. */
  en: string;
}

/* A problem to show beside the field, or null when the value looks right. */
export type ValidationMessage = ValidationProblem | null;

function problem(
  id: ValidationMessageId,
  en: string,
  params?: Record<string, string | number>
): ValidationProblem {
  return params ? { id, params, en } : { id, en };
}

/* The state field a driver licence number is checked against. */
export type DlStateField = 'ownerDlState' | 'co1DlState';

export const VALIDATORS = {
  /* 17 characters, and I, O and Q are never used because they are too easily
     confused with 1 and 0. */
  vin: (v: string): ValidationMessage => {
    const t = v.toUpperCase().replace(/\s/g, '');
    if (t.length !== 17) {
      return problem('vin.length', `A VIN is 17 characters. You have entered ${t.length}.`, { n: t.length });
    }
    if (/[IOQ]/.test(t)) {
      return problem('vin.forbiddenLetters', 'A VIN never contains the letters I, O or Q. Please check for a 1 or a 0.');
    }
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(t)) {
      return problem('vin.alphanumeric', 'A VIN uses only letters and numbers.');
    }
    return null;
  },

  /* California plates are 7 characters (client §6). */
  plate: (v: string): ValidationMessage => {
    const t = v.toUpperCase().replace(/[\s-]/g, '');
    if (t.length !== 7) {
      return problem('plate.length', `A California plate is 7 characters. You have entered ${t.length}.`, { n: t.length });
    }
    if (!/^[A-Z0-9]{7}$/.test(t)) {
      return problem('plate.alphanumeric', 'A plate number uses only letters and numbers.');
    }
    return null;
  },

  /* California DL/ID: one letter followed by seven digits (client §6).
     Other states vary, so only California is checked. */
  driverLicense: (v: string, data: FormData, stateField: DlStateField): ValidationMessage => {
    const state = data[stateField];
    const t = v.toUpperCase().replace(/\s/g, '');
    if (state && state !== 'CA') return null;
    if (!/^[A-Z]\d{7}$/.test(t)) {
      return problem('driverLicense.format',
        'A California driver license is one letter followed by seven digits, for example D1234567.');
    }
    return null;
  },

  /* A street address, not a mailbox.

     REG 343 asks for the PHYSICAL residence or business address, and DMV will
     not register a vehicle to a PO box: the address determines the county, and
     the county determines the fees. Catching it here saves a wasted trip, which
     is the whole point of the checklist appearing before the queue. */
  physicalAddress: (v: string): ValidationMessage => {
    const t = v.trim();
    if (/\b(p\.?\s*o\.?\s*box|post\s*office\s*box|postal\s*box)\b/i.test(t)) {
      return problem(
        'address.poBox',
        'This must be a street address, not a PO box. A PO box can be used for the mailing address below.'
      );
    }
    if (t.length < 5) return problem('address.short', 'Enter the full street address.');
    /* A street address has a number and a name. Deliberately loose: rural
       routes, unit-only military addresses and some older parcels do not follow
       the usual shape, and this is advisory anyway. */
    if (!/\d/.test(t)) return problem('address.noNumber', 'A street address usually starts with a number.');
    return null;
  },

  /* Mailing address may be a PO box, so only the length check applies. */
  mailingAddress: (v: string): ValidationMessage =>
    v.trim().length < 5 ? problem('address.short', 'Enter the full address.') : null,

  /* `state` is optional because only California can be checked by name: the
     place list is a California one, and guessing at other states' city names
     would flag correct addresses. */
  city: (v: string, state?: string): ValidationMessage => {
    const t = v.trim();
    if (t.length < 2) return problem('city.short', 'Enter the full city name.');
    if (/\d/.test(t)) return problem('city.digits', 'A city name does not contain numbers.');
    /* A well-formed but invented name — the tester's "Sacrapinot" — passes
       every shape check above, so the name itself has to be looked up. */
    if (state === 'CA' && !isCaliforniaPlace(t)) {
      return problem(
        'city.unknownCalifornia',
        'We could not find that city in California. Check the spelling, or the state above.'
      );
    }
    return null;
  },

  /* A ZIP that cannot belong to the state beside it is almost always a typo,
     and a wrong ZIP sends the registration to the wrong county — which changes
     the fees. Only California is range-checked, because that is the one this
     office actually issues. */
  zip: (v: string, state?: string): ValidationMessage => {
    const t = v.trim();
    if (!/^\d{5}(-?\d{4})?$/.test(t)) {
      return problem('zip.format', 'A ZIP code is 5 digits, or 5 plus 4.');
    }
    if (state === 'CA') {
      const five = Number(t.slice(0, 5));
      if (five < 90001 || five > 96162) {
        return problem('zip.notCalifornia', 'That ZIP code is not in California. Check the ZIP or the state.');
      }
    }
    return null;
  },

  phone: (v: string): ValidationMessage => {
    const d = v.replace(/\D/g, '');
    if (d.length !== 10) {
      return problem('phone.length', 'A telephone number is 10 digits including the area code.');
    }
    return null;
  },

  yearModel: (v: string): ValidationMessage => {
    const n = Number(v);
    const max = new Date().getFullYear() + 1;
    if (!Number.isInteger(n) || n < 1900 || n > max) {
      return problem('yearModel.range', `Enter a year between 1900 and ${max}.`, { min: 1900, max });
    }
    return null;
  },

  odometer: (v: string): ValidationMessage =>
    /^\d+$/.test(v.trim())
      ? null
      : problem('odometer.wholeNumber', 'Enter whole miles only, with no decimal point and no commas.'),

  currency: (v: string): ValidationMessage =>
    /^\d+(\.\d{1,2})?$/.test(v.trim().replace(/,/g, ''))
      ? null
      : problem('currency.format', 'Enter an amount, for example 18500.00'),

  notFuture: (v: string): ValidationMessage => {
    if (!v) return null;
    return new Date(v) > new Date()
      ? problem('date.notFuture', 'This date cannot be in the future.')
      : null;
  }
};
