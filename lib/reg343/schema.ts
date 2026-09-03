/* ==========================================================================
   REG 343 — Application for Title or Registration (REV. 4/2021)
   Declarative field schema. Mirrors docs/02_Functional_and_Form_Specification.md §3.
   Section 9 (certifications) is intentionally absent: signature is wet, at the counter.

   Ported from legacy-demo/js/form-reg343.js with the field order, ids, labels,
   hints and conditional logic unchanged.
   ========================================================================== */

import {
  CA_COUNTIES,
  US_STATES,
  type FieldValue,
  type FormData,
  type Reg343FieldId
} from '../types';
import { VALIDATORS, type ValidationMessage, type ValidationProblem } from './validators';

export { CA_COUNTIES, US_STATES };
export {
  ADVISORIES,
  SUPPLEMENTARY,
  triggeredAdvisories,
  triggeredForms,
  type Advisory,
  type SupplementaryForm
} from './supplementary';

const YESNO = ['Yes', 'No'] as const;

export type FieldType =
  | 'text' | 'number' | 'select' | 'radio' | 'checkbox' | 'textarea' | 'date' | 'tel' | 'currency';

export interface FieldDef {
  id: Reg343FieldId;
  label: string;
  type: FieldType;
  /* Option values are always the English strings — see lib/types.ts. */
  options?: readonly string[];
  required?: boolean;
  /* Renders at half width, paired with the next half field. */
  half?: boolean;
  /* Radio options sit on one line rather than stacked. */
  inline?: boolean;
  max?: number;
  hint?: string;
  showIf?: (f: FormData) => boolean;
  validate?: (value: string, data: FormData) => ValidationMessage;
}

export interface Section {
  id: string;
  num: number;
  title: string;
  note?: string;
  showIf?: (f: FormData) => boolean;
  fields: FieldDef[];
}

export const REG343: Section[] = [
  {
    id: 'vehicle', num: 1, title: 'Vehicle Information',
    fields: [
      { id: 'vin', label: 'Vehicle Identification Number', type: 'text', required: true, max: 17,
        validate: v => VALIDATORS.vin(v),
        hint: '17 characters. Found on the dashboard at the base of the windshield, or the driver-side door frame.' },
      { id: 'make', label: 'Vehicle Make', type: 'text', required: true, half: true },
      { id: 'yearModel', label: 'Year Model', type: 'number', required: true, half: true,
        validate: v => VALIDATORS.yearModel(v) },
      { id: 'fuelType', label: 'Fuel Type', type: 'select', required: true,
        options: ['Gasoline','Diesel','Electric','Hybrid','Flex Fuel','Hydrogen','Other'] },
      { id: 'plate', label: 'California License Plate Number', type: 'text', half: true, max: 8,
        validate: v => VALIDATORS.plate(v),
        hint: 'Leave blank if this vehicle has never been registered in California.' },
      { id: 'modelSeries', label: 'Model or Series', type: 'text', half: true },
      { id: 'bodyType', label: 'Body Type Model', type: 'text', half: true },
      { id: 'vehicleType', label: 'Type of Vehicle', type: 'radio', required: true,
        options: ['Auto','Commercial (includes truck or pickup)','Motorcycle','Off Highway','Trailer Coach'] },
      { id: 'mcEngineNo', label: 'Motorcycle Engine Number', type: 'text',
        showIf: f => f.vehicleType === 'Motorcycle' },
      { id: 'tcLength', label: 'Trailer coach length (inches)', type: 'number', half: true,
        showIf: f => f.vehicleType === 'Trailer Coach' },
      { id: 'tcWidth', label: 'Trailer coach width (inches)', type: 'number', half: true,
        showIf: f => f.vehicleType === 'Trailer Coach' },
      { id: 'forHire', label: 'Will this vehicle be used for the transportation of persons for hire, compensation, or profit?', type: 'radio', options: YESNO, required: true, inline: true,
        hint: 'For example a limousine, taxi or bus.' },
      { id: 'commercial10k', label: 'Is this a commercial vehicle operating at 10,001 lbs or more?', type: 'radio', options: YESNO, required: true, inline: true,
        hint: 'Also answer yes for a pickup exceeding 8,001 lbs unladen and/or 11,499 lbs GVWR.' },
      { id: 'axles', label: 'Number of axles', type: 'number', half: true,
        showIf: f => f.commercial10k === 'Yes' },
      { id: 'unladenWeight', label: 'Unladen weight (lbs)', type: 'number', half: true,
        showIf: f => f.commercial10k === 'Yes' },
      { id: 'unladenBasis', label: 'Weight basis', type: 'radio', options: ['Actual','Estimated'], inline: true,
        showIf: f => f.commercial10k === 'Yes',
        hint: 'Estimated may be used for vehicles over 10,001 lbs only.' }
    ]
  },

  {
    id: 'owner', num: 2, title: 'Owner Information',
    note: 'Each owner signs on paper at the counter. Enter names exactly as they appear on the identity document.',
    fields: [
      { id: 'ownerName', label: 'True full name of owner', type: 'text', required: true,
        hint: 'Last, First, Middle, Suffix — or the business name.' },
      { id: 'ownerDl', label: 'Driver license / ID card number', type: 'text', required: true, half: true,
        validate: (v, d) => VALIDATORS.driverLicense(v, d, 'ownerDlState') },
      { id: 'ownerDlState', label: 'State', type: 'select', options: US_STATES, required: true, half: true },

      { id: 'hasCoOwner', label: 'Is there a co-owner or lessee?', type: 'radio', options: YESNO, required: true, inline: true },
      { id: 'co1Join', label: 'Co-owner is joined by', type: 'radio', options: ['AND','OR'], inline: true,
        showIf: f => f.hasCoOwner === 'Yes',
        hint: 'AND means every owner must sign to transfer the vehicle later. OR means any single owner can sign. This choice is difficult to change afterwards.' },
      { id: 'co1Name', label: 'Co-owner true full name', type: 'text', showIf: f => f.hasCoOwner === 'Yes' },
      { id: 'co1Dl', label: 'Co-owner DL / ID number', type: 'text', half: true, showIf: f => f.hasCoOwner === 'Yes',
        validate: (v, d) => VALIDATORS.driverLicense(v, d, 'co1DlState') },
      { id: 'co1DlState', label: 'State', type: 'select', options: US_STATES, half: true, showIf: f => f.hasCoOwner === 'Yes' },

      { id: 'physAddress', label: 'Physical residence or business address', type: 'text', required: true,
        validate: v => VALIDATORS.physicalAddress(v),
        hint: 'Include St., Ave., Ct. etc. A PO box cannot be used here.' },
      { id: 'physApt', label: 'Apt / Space / Suite', type: 'text', half: true },
      { id: 'physCity', label: 'City', type: 'text', required: true, half: true,
        validate: (v, d) => VALIDATORS.city(v, d.physState as string | undefined) },
      { id: 'physState', label: 'State', type: 'select', options: US_STATES, required: true, half: true },
      { id: 'physZip', label: 'ZIP Code', type: 'text', required: true, half: true, max: 10,
        validate: (v, d) => VALIDATORS.zip(v, d.physState as string | undefined) },
      { id: 'county', label: 'County of residence, or where the vehicle is principally garaged', type: 'select', options: CA_COUNTIES, required: true },
      { id: 'mailDifferent', label: 'Is your mailing address different from the address above?', type: 'radio', options: YESNO, required: true, inline: true },
      /* A PO box is fine here — it is only the physical address DMV refuses. */
      { id: 'mailAddress', label: 'Mailing address', type: 'text', showIf: f => f.mailDifferent === 'Yes',
        validate: v => VALIDATORS.mailingAddress(v) },
      { id: 'mailApt', label: 'Apt / Space / Suite', type: 'text', half: true, showIf: f => f.mailDifferent === 'Yes' },
      { id: 'mailCity', label: 'City', type: 'text', half: true, showIf: f => f.mailDifferent === 'Yes',
        validate: (v, d) => VALIDATORS.city(v, d.mailState as string | undefined) },
      { id: 'mailState', label: 'State', type: 'select', options: US_STATES, half: true, showIf: f => f.mailDifferent === 'Yes' },
      { id: 'mailZip', label: 'ZIP Code', type: 'text', half: true, showIf: f => f.mailDifferent === 'Yes',
        validate: (v, d) => VALIDATORS.zip(v, d.mailState as string | undefined) },
      { id: 'daytimePhone', label: 'Daytime telephone number', type: 'tel', required: true, half: true,
        validate: v => VALIDATORS.phone(v) }
    ]
  },

  {
    id: 'legalowner', num: 3, title: 'Legal Owner / Lienholder',
    fields: [
      { id: 'hasLienholder', label: 'Is there a lienholder or titleholder on this vehicle?', type: 'radio', required: true, inline: true,
        options: ['No lienholder','Yes, there is a lienholder'],
        hint: 'A lienholder is a bank or finance company with a financial interest in the vehicle. If there is none, the form records "NONE".' },
      { id: 'lienName', label: 'True full name of bank, finance company or individual', type: 'text',
        showIf: f => f.hasLienholder === 'Yes, there is a lienholder',
        hint: 'Do not re-enter the name of the registered owner.' },
      { id: 'eltNo', label: 'Electronic Lienholder (ELT) ID number', type: 'text', half: true,
        showIf: f => f.hasLienholder === 'Yes, there is a lienholder',
        hint: 'Must match the ELT listing exactly.' },
      /* A bank lockbox is a PO box, so this takes the mailing rule, not the physical one. */
      { id: 'lienAddress', label: 'Lienholder address', type: 'text',
        showIf: f => f.hasLienholder === 'Yes, there is a lienholder',
        validate: v => VALIDATORS.mailingAddress(v) },
      { id: 'lienCity', label: 'City', type: 'text', half: true, showIf: f => f.hasLienholder === 'Yes, there is a lienholder',
        validate: (v, d) => VALIDATORS.city(v, d.lienState as string | undefined) },
      { id: 'lienState', label: 'State', type: 'select', options: US_STATES, half: true, showIf: f => f.hasLienholder === 'Yes, there is a lienholder' },
      { id: 'lienZip', label: 'ZIP Code', type: 'text', half: true, showIf: f => f.hasLienholder === 'Yes, there is a lienholder',
        validate: (v, d) => VALIDATORS.zip(v, d.lienState as string | undefined) }
    ]
  },

  {
    id: 'odometer', num: 4, title: 'Odometer Information',
    fields: [
      { id: 'odometerReading', label: 'Odometer reading', type: 'number', required: true,
        validate: v => VALIDATORS.odometer(v),
        hint: 'Whole numbers only — do not include tenths.' },
      { id: 'odometerUnits', label: 'Units', type: 'radio', options: ['Miles','Kilometres'], inline: true, required: true },
      { id: 'odometerBasis', label: 'This reading is', type: 'radio', required: true,
        options: ['The reading on the date of purchase in California','The reading as of today (no change in ownership)'] },
      { id: 'odometerFlag', label: 'Does either of these apply?', type: 'radio', required: true,
        options: ['No — the reading is the actual mileage','The reading is NOT the actual mileage','Mileage EXCEEDS the odometer mechanical limits'] },
      { id: 'discrepancyExplain', label: 'Explain the odometer discrepancy', type: 'textarea',
        showIf: f => !!f.odometerFlag && f.odometerFlag !== 'No — the reading is the actual mileage' }
    ]
  },

  {
    id: 'dates', num: 5, title: 'Date Information',
    fields: [
      { id: 'acquiredDate', label: 'Date the vehicle was purchased or acquired', type: 'date', required: true,
        validate: v => VALIDATORS.notFuture(v) },
      { id: 'condition', label: 'The vehicle was', type: 'radio', options: ['New','Used'], required: true, inline: true },
      { id: 'placeOfPurchase', label: 'The vehicle was purchased', type: 'radio', options: ['Inside California','Outside California'], required: true, inline: true },
      { id: 'enteredCA', label: 'Date the vehicle entered, or will enter, California', type: 'date',
        showIf: f => f.placeOfPurchase === 'Outside California' },
      { id: 'didNotOwnAtEntry', label: 'I did not own the vehicle at the time it entered California', type: 'checkbox',
        showIf: f => f.placeOfPurchase === 'Outside California' },
      { id: 'firstOperatedCA', label: 'Date the vehicle was, or will be, first operated in California', type: 'date',
        showIf: f => f.placeOfPurchase === 'Outside California' },
      { id: 'residencyDate', label: 'Date you went to work in California, obtained a California driver license, or became a resident', type: 'date',
        hint: 'Whichever happened first. If you have been a resident since birth, enter your date of birth.' },
      { id: 'notCAResident', label: 'I am not a California resident', type: 'checkbox' }
    ]
  },

  {
    id: 'cost', num: 6, title: 'Cost Information',
    note: 'Total cost must include the basic vehicle, the value of any trade-in, and all accessories and leased equipment permanently attached. It excludes sales tax, insurance, finance charges and warranty.',
    fields: [
      { id: 'acquisitionMethod', label: 'How did you acquire this vehicle?', type: 'radio', required: true,
        options: ['Purchase','Gift','Trade'] },
      { id: 'purchasePrice', validate: v => VALIDATORS.currency(v), label: 'Purchase price', type: 'currency', required: true,
        showIf: f => f.acquisitionMethod === 'Purchase' },
      { id: 'giftValue', validate: v => VALIDATORS.currency(v), label: 'Current market value', type: 'currency', required: true,
        showIf: f => f.acquisitionMethod === 'Gift' },
      { id: 'tradeValue', validate: v => VALIDATORS.currency(v), label: 'Value when acquired', type: 'currency', required: true,
        showIf: f => f.acquisitionMethod === 'Trade' },
      { id: 'acquiredFrom', label: 'The vehicle was purchased or acquired from', type: 'radio', required: true,
        options: ['Dealer','Private Party','Dismantler','Immediate Family Member'] },
      { id: 'familyRelationship', label: 'State the relationship', type: 'text',
        showIf: f => f.acquiredFrom === 'Immediate Family Member' },
      { id: 'bodyModifications', label: 'Since acquiring the vehicle, have any body type modifications, additions or alterations been made?', type: 'radio', options: YESNO, required: true, inline: true,
        hint: 'For example changing from a pickup to a utility body.' }
    ]
  },

  {
    id: 'outofstate', num: 7, title: 'Out-of-State or Out-of-Country Vehicles',
    showIf: f => f.placeOfPurchase === 'Outside California',
    fields: [
      { id: 'salesTaxPaid', label: 'For vehicles entering California within one year of purchase — was sales tax paid to another state?', type: 'radio', options: ['Not applicable','Yes','No'], inline: true },
      { id: 'salesTaxAmount', validate: v => VALIDATORS.currency(v), label: 'Amount of tax paid', type: 'currency',
        showIf: f => f.salesTaxPaid === 'Yes',
        hint: 'This amount will be credited toward any Use Tax due in California.' },
      { id: 'lastRegisteredAs', label: 'In the last state of registration, this vehicle was registered as a', type: 'radio', options: ['Commercial Vehicle','Non-commercial Automobile'], inline: true },
      { id: 'plateDisposition', label: 'Disposition of out-of-state plates', type: 'radio',
        options: ['Expired','Surrendered to CA DMV','Destroyed','Retained','Returned to the issuing state'],
        hint: 'The plates must not be affixed to any vehicle unless it is dual registered in both states.' }
    ]
  },

  {
    id: 'military', num: 8, title: 'Military Service Information',
    fields: [
      { id: 'activeDuty', label: 'Are you or your spouse on active duty as a member of the U.S. Uniformed Services?', type: 'radio', options: YESNO, required: true, inline: true },
      { id: 'activeDutyWhenLicensed', label: 'When this vehicle was last licensed, were you or your spouse on active duty?', type: 'radio', options: YESNO, inline: true,
        showIf: f => f.activeDuty === 'Yes' },
      { id: 'stationedWhere', label: 'In what state or country were you or your spouse stationed?', type: 'text',
        showIf: f => f.activeDutyWhenLicensed === 'Yes' }
    ]
  }
];

/* ---- helpers ------------------------------------------------------------ */

export interface MissingField {
  section: string;
  id: Reg343FieldId;
  label: string;
}

export interface FormatProblem {
  /* The FIELD's id — not the message's. The message carries its own. */
  id: Reg343FieldId;
  label: string;
  section: string;
  /* The English sentence. Kept as a plain string so that everything already
     rendering `problem.message` keeps working; read `problem.problem.id` to
     translate it. */
  message: string;
  /* The same message, structured: a stable id, its interpolated params, and
     the English text. This is what a translation is looked up by. */
  problem: ValidationProblem;
}

export function visibleSections(data: FormData): Section[] {
  return REG343.filter(s => !s.showIf || s.showIf(data));
}

export function visibleFields(section: Section, data: FormData): FieldDef[] {
  return section.fields.filter(f => !f.showIf || f.showIf(data));
}

/* Runs the validator for a field, if it has one. Returns a message or null. */
export function validateField(field: FieldDef, value: FieldValue, data?: FormData): ValidationMessage {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  if (!field.validate) return null;
  return field.validate(String(value), data || {});
}

/* Every visible field that currently fails its format check. Advisory only —
   nothing here prevents the customer from submitting. */
export function formatProblems(data: FormData): FormatProblem[] {
  const out: FormatProblem[] = [];
  visibleSections(data).forEach(section => {
    visibleFields(section, data).forEach(f => {
      const msg = validateField(f, data[f.id], data);
      if (msg) {
        out.push({ id: f.id, label: f.label, section: section.title, message: msg.en, problem: msg });
      }
    });
  });
  return out;
}

export function missingRequired(data: FormData): MissingField[] {
  const out: MissingField[] = [];
  visibleSections(data).forEach(section => {
    visibleFields(section, data).forEach(f => {
      if (!f.required) return;
      const v = data[f.id];
      if (v === undefined || v === null || String(v).trim() === '') {
        out.push({ section: section.title, id: f.id, label: f.label });
      }
    });
  });
  return out;
}

/* Fraction of the visible, answerable fields that carry a value. Checkboxes
   are excluded: an unticked box is an answer, not an omission. */
export function completeness(data: FormData): number {
  let total = 0, filled = 0;
  visibleSections(data).forEach(section => {
    visibleFields(section, data).forEach(f => {
      if (f.type === 'checkbox') return;
      total++;
      const v = data[f.id];
      if (v !== undefined && v !== null && String(v).trim() !== '') filled++;
    });
  });
  return total === 0 ? 0 : filled / total;
}

/* Look up a field definition by id, across every section. */
export function fieldById(id: string): FieldDef | undefined {
  for (const section of REG343) {
    const f = section.fields.find(x => x.id === id);
    if (f) return f;
  }
  return undefined;
}

/* Write one answer. The value union across all field ids is wider than any
   single field's type, so the assignment is narrowed here once rather than at
   every call site in the form UI. */
export function setFieldValue(data: FormData, id: Reg343FieldId, value: FieldValue): FormData {
  (data as Record<string, FieldValue>)[id] = value;
  return data;
}
