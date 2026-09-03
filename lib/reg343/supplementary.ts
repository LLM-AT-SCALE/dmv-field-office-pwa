/* ==========================================================================
   Supplementary forms and advisories triggered by REG 343 answers.

   Surfaced to the customer inline, while they are still able to fetch a
   document or ask a question, rather than at the counter where the answer is
   "come back tomorrow". Ported unchanged from legacy-demo/js/form-reg343.js.
   ========================================================================== */

import type { FormData } from '../types';

export interface SupplementaryForm {
  /* DMV form number, e.g. 'REG 4008'. */
  form: string;
  title: string;
  when: (f: FormData) => boolean;
}

export interface Advisory {
  when: (f: FormData) => boolean;
  text: string;
}

/* Supplementary forms triggered by answers — surfaced to the customer inline. */
export const SUPPLEMENTARY: SupplementaryForm[] = [
  { form: 'REG 4008', title: 'Declaration of Gross Vehicle Weight',
    when: f => f.commercial10k === 'Yes' },
  { form: 'REG 256', title: 'Statement of Facts',
    when: f => f.acquisitionMethod === 'Gift' },
  { form: 'REG 5036', title: 'Statement of Construction',
    when: f => f.bodyModifications === 'Yes' },
  { form: 'REG 5045', title: 'Nonresident Military VLF Exemption',
    when: f => f.activeDuty === 'Yes' }
];

/* Non-form advisories */
export const ADVISORIES: Advisory[] = [
  { when: f => f.forHire === 'Yes',
    text: 'A Motor Carrier Permit may be required for vehicles carrying persons for hire.' }
];

export function triggeredForms(data: FormData): SupplementaryForm[] {
  return SUPPLEMENTARY.filter(s => s.when(data));
}

export function triggeredAdvisories(data: FormData): Advisory[] {
  return ADVISORIES.filter(a => a.when(data));
}
