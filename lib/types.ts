/* ==========================================================================
   Shared domain types.

   Ported from the verified vanilla-JS demo (legacy-demo/js/store.js and
   form-reg343.js). The shapes are unchanged — only the types are new.

   The option values below are ENGLISH regardless of the language the customer
   is reading the form in. Translation happens at display time only: the value
   that is stored, autosaved and later written into the DMV AcroForm is always
   the English string, because the PDF mapping keys off it. They are declared
   as string literal unions so a typo is a compile error rather than a field
   that silently fails to appear on the printed form.
   ========================================================================== */

export type ServiceCode = 'VR' | 'DL';

/* Set to 'submitted' when the customer sends the application to the counter;
   'waiting' until then (and again if they edit it afterwards, or retract an
   eDL 44 reference).

   'serving', 'complete' and 'abandoned' are the counter-side states. In this
   product 'complete' is largely theoretical: when the technician completes the
   transaction the session is PURGED rather than marked, because retention is
   the point (see splitExpired in lib/office.ts). They exist so a store that
   defers the purge — or an API guarding against a write to a finished
   application — has a state to name. */
export type SessionStatus = 'waiting' | 'submitted' | 'serving' | 'complete' | 'abandoned';

/* ---- REG 343 option values (English, always) ---------------------------- */

export type YesNo = 'Yes' | 'No';

export type FuelType =
  | 'Gasoline' | 'Diesel' | 'Electric' | 'Hybrid' | 'Flex Fuel' | 'Hydrogen' | 'Other';

export type VehicleType =
  | 'Auto'
  | 'Commercial (includes truck or pickup)'
  | 'Motorcycle'
  | 'Off Highway'
  | 'Trailer Coach';

export type UnladenBasis = 'Actual' | 'Estimated';

export type CoOwnerJoin = 'AND' | 'OR';

export type LienholderChoice = 'No lienholder' | 'Yes, there is a lienholder';

export type OdometerUnits = 'Miles' | 'Kilometres';

export type OdometerBasis =
  | 'The reading on the date of purchase in California'
  | 'The reading as of today (no change in ownership)';

export type OdometerFlag =
  | 'No — the reading is the actual mileage'
  | 'The reading is NOT the actual mileage'
  | 'Mileage EXCEEDS the odometer mechanical limits';

export type VehicleCondition = 'New' | 'Used';

export type PlaceOfPurchase = 'Inside California' | 'Outside California';

export type AcquisitionMethod = 'Purchase' | 'Gift' | 'Trade';

export type AcquiredFrom = 'Dealer' | 'Private Party' | 'Dismantler' | 'Immediate Family Member';

export type SalesTaxPaid = 'Not applicable' | 'Yes' | 'No';

export type LastRegisteredAs = 'Commercial Vehicle' | 'Non-commercial Automobile';

export type PlateDisposition =
  | 'Expired'
  | 'Surrendered to CA DMV'
  | 'Destroyed'
  | 'Retained'
  | 'Returned to the issuing state';

export const US_STATES = [
  'CA','AL','AK','AZ','AR','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA',
  'RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
] as const;

export type UsState = (typeof US_STATES)[number];

export const CA_COUNTIES = [
  'Alameda','Amador','Butte','Calaveras','Colusa','Contra Costa','El Dorado','Fresno','Glenn',
  'Humboldt','Imperial','Inyo','Kern','Kings','Lake','Lassen','Los Angeles','Madera','Marin',
  'Mariposa','Mendocino','Merced','Modoc','Mono','Monterey','Napa','Nevada','Orange','Placer',
  'Plumas','Riverside','Sacramento','San Benito','San Bernardino','San Diego','San Francisco',
  'San Joaquin','San Luis Obispo','San Mateo','Santa Barbara','Santa Clara','Santa Cruz','Shasta',
  'Sierra','Siskiyou','Solano','Sonoma','Stanislaus','Sutter','Tehama','Trinity','Tulare',
  'Tuolumne','Ventura','Yolo','Yuba'
] as const;

export type CaCounty = (typeof CA_COUNTIES)[number];

/* ---- REG 343 captured answers -------------------------------------------

   Every value is optional: the form is filled over a visit, autosaved from the
   first keystroke, and submitted incomplete if that is what the customer has.
   Text, number, date and currency inputs all store strings, exactly as the DOM
   hands them over; only checkboxes store a boolean.                          */

export interface Reg343FormData {
  /* 1 — vehicle */
  vin?: string;
  make?: string;
  yearModel?: string;
  fuelType?: FuelType;
  plate?: string;
  modelSeries?: string;
  bodyType?: string;
  vehicleType?: VehicleType;
  mcEngineNo?: string;
  tcLength?: string;
  tcWidth?: string;
  forHire?: YesNo;
  commercial10k?: YesNo;
  axles?: string;
  unladenWeight?: string;
  unladenBasis?: UnladenBasis;

  /* 2 — owner */
  ownerName?: string;
  ownerDl?: string;
  ownerDlState?: UsState;
  hasCoOwner?: YesNo;
  co1Join?: CoOwnerJoin;
  co1Name?: string;
  co1Dl?: string;
  co1DlState?: UsState;
  physAddress?: string;
  physApt?: string;
  physCity?: string;
  physState?: UsState;
  physZip?: string;
  county?: CaCounty;
  mailDifferent?: YesNo;
  mailAddress?: string;
  mailApt?: string;
  mailCity?: string;
  mailState?: UsState;
  mailZip?: string;
  daytimePhone?: string;

  /* Not collected by the customer form — the technician's equipment number,
     written into the AcroForm when the counter supplies one. */
  equipmentNo?: string;

  /* 3 — legal owner / lienholder */
  hasLienholder?: LienholderChoice;
  lienName?: string;
  eltNo?: string;
  lienAddress?: string;
  lienCity?: string;
  lienState?: UsState;
  lienZip?: string;

  /* 4 — odometer */
  odometerReading?: string;
  odometerUnits?: OdometerUnits;
  odometerBasis?: OdometerBasis;
  odometerFlag?: OdometerFlag;
  discrepancyExplain?: string;

  /* 5 — dates */
  acquiredDate?: string;
  condition?: VehicleCondition;
  placeOfPurchase?: PlaceOfPurchase;
  enteredCA?: string;
  didNotOwnAtEntry?: boolean;
  firstOperatedCA?: string;
  residencyDate?: string;
  notCAResident?: boolean;

  /* 6 — cost */
  acquisitionMethod?: AcquisitionMethod;
  purchasePrice?: string;
  giftValue?: string;
  tradeValue?: string;
  acquiredFrom?: AcquiredFrom;
  familyRelationship?: string;
  bodyModifications?: YesNo;

  /* 7 — out of state */
  salesTaxPaid?: SalesTaxPaid;
  salesTaxAmount?: string;
  lastRegisteredAs?: LastRegisteredAs;
  plateDisposition?: PlateDisposition;

  /* 8 — military */
  activeDuty?: YesNo;
  activeDutyWhenLicensed?: YesNo;
  stationedWhere?: string;

  /* Autosave writes one field at a time, by name, from a JSON body — so the
     draft store needs to index this by a string it validated at runtime. The
     declared fields above keep their types: `data.vehicleType = 'Ato'` is
     still a compile error, and so is `data['vehicleType'] = 'Ato'`. */
  [field: string]: FieldValue;
}

/* The captured REG 343 answers. Aliased because the form data of this product
   is the REG 343 form data; `Reg343FormData` is available where the DOM's own
   global `FormData` is also in play. */
export type FormData = Reg343FormData;

/* Drops the index signature's `string | number` keys, keeping only the fields
   declared above.

   `keyof Reg343FormData` cannot be used directly: the moment the interface
   gained its index signature (so the autosave endpoint could write a field by
   a name it validated at runtime), `keyof` widened to `string | number`. That
   silently turns every FieldDef.id, MissingField.id and FormatProblem.id into
   "any string", which is the opposite of the guarantee this type exists to
   give — a mistyped field id has to be a compile error. */
type DeclaredKeys<T> = {
  [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K]
};

export type Reg343FieldId = keyof DeclaredKeys<Reg343FormData>;

/* What a single answer can be: a string from every input type, a boolean from
   a checkbox, null to clear a field, or nothing yet.

   Deliberately NOT `number`. A client may well PATCH numeric JSON for a year
   model or a currency amount, and the autosave route converts it at the
   boundary — but by the time a value is stored it is a string, because every
   answer ends up in an AcroForm text field via String(). Allowing `number`
   here would read as permission to store one, leaving "1999" and 1999 to
   diverge downstream with a single String() call in one route as the only
   thing preventing it. Narrower is the point: the wrong thing is
   unrepresentable rather than merely unwritten. */
export type FieldValue = string | boolean | null | undefined;

/* ---- office ------------------------------------------------------------- */

export interface OfficeHours {
  /* 24-hour 'HH:MM', wall-clock time at the office. `close` drives ticket
     expiry. */
  open: string;
  close: string;
  /* Human-readable opening summary, shown to the customer. */
  today: string;
  /* IANA zone these times are in. Present so that "close of business" means
     the office's 5pm and not the server's — see expiryFor() in lib/office.ts.
     Defaults to America/Los_Angeles when omitted. */
  timeZone?: string;
}

export interface Office {
  id: string;
  name: string;
  address: string;
  hours: OfficeHours;
  layout: string[];
  /* Set when the customer arrived with an office identifier we do not have
     data for. The interface falls back to the default office but must say so,
     rather than misleading them about which building they are standing in. */
  unresolved?: string;
}

export interface ServiceSubTransaction {
  id: string;
  label: string;
}

export interface Service {
  code: ServiceCode;
  name: string;
  /* Token prefix: VR tickets are A-042, DL tickets are B-019. */
  prefix: string;
  blurb: string;
  subs: ServiceSubTransaction[];
}

export interface ChecklistItem {
  /* Title */
  t: string;
  /* Optional hint */
  h?: string;
}

/* ---- session ------------------------------------------------------------ */

export interface Session {
  session_id: string;
  office_id: string;
  /* Printed and barcoded, e.g. 'A-042'. */
  token_number: string;
  seq: number;
  service: ServiceCode;
  sub_transaction: string;
  issued_at: string;
  /* Close of business on the day of issue — see expiryFor() in lib/office.ts. */
  expires_at: string;
  status: SessionStatus;
  form_data: FormData;
  submitted_at: string | null;
  /* Reference number from the separate online eDL 44 application (DL only).
     The number and when it was given are all this product ever holds for a
     driver licence: the application itself lives at edl.dmv.ca.gov. */
  edl_confirmation_number: string | null;
}

/* ---- queue -------------------------------------------------------------- */

export interface QueueState {
  /* Epoch ms the counters were last (re-)seeded from. */
  base: number;
  /* Seconds of real time per customer served. Optional: a store that keeps the
     pilot pacing omits it and the default applies. */
  tick?: number;
  servingVR: number;
  servingDL: number;
  nextVR: number;
  nextDL: number;
}
