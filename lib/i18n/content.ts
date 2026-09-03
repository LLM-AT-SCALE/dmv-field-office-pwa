/* ==========================================================================
   Spanish content — services, checklists and the REG 343 form

   Field labels are translated for COMPREHENSION only. The data the customer
   enters is written into the English legal form unchanged, because REG 343 is
   an English document filed with the State. A Spanish speaker understands what
   is being asked; DMV receives the form it expects.

   Working drafts. A certified translator must review before pilot — DMV
   publishes its own Spanish terminology for these fields.

   ---------------------------------------------------------------------------
   CRITICAL — TRANSLATE LABELS, NEVER VALUES.

   The customer sees "Automóvil" and the app stores 'Auto'. The Spanish option
   maps below are keyed BY the English value and return display text only; the
   English key is what goes into form data and into the PDF. Anything that
   writes to form state must store the English option string.

   Translating the stored value instead of the label would break the PDF field
   mapping silently: the form would still submit, the PDF would still generate,
   and the State would receive a REG 343 with 'Gasolina' in a field whose only
   legal values are Gasoline / Diesel / Electric / Hybrid / Flex Fuel /
   Hydrogen / Other. No error surfaces — the filing is simply wrong.
   ------------------------------------------------------------------------ */

import type { Lang } from './dictionary';
import { REG343, fieldById } from '@/lib/reg343/schema';
import type { FieldDef, FormatProblem, Section } from '@/lib/reg343/schema';
import type { ValidationMessageId, ValidationProblem } from '@/lib/reg343/validators';
import type {
  AcquiredFrom,
  AcquisitionMethod,
  ChecklistItem,
  CoOwnerJoin,
  FuelType,
  LastRegisteredAs,
  LienholderChoice,
  Office,
  OdometerBasis,
  OdometerFlag,
  OdometerUnits,
  PlaceOfPurchase,
  PlateDisposition,
  SalesTaxPaid,
  ServiceCode,
  UnladenBasis,
  VehicleCondition,
  VehicleType,
  YesNo,
} from '@/lib/types';

/* The English catalog. Spanish is an overlay on it: every lookup below falls
   back to the English text when a Spanish string is missing, so a gap in the
   translation degrades to English rather than to a blank label. */
import { SERVICES, CHECKLISTS, OFFICES } from '@/lib/office';

/* ---- shapes ------------------------------------------------------------- */

export interface EsService {
  name: string;
  blurb: string;
  /** sub-service id → Spanish label */
  subs: Record<string, string>;
}

export interface EsField {
  label: string;
  /** Present and undefined means "this field has no hint in Spanish". */
  hint?: string;
  /** English option value → Spanish display text. The key is what gets stored. */
  options?: Record<string, string>;
}

/* ---- Spanish content maps ----------------------------------------------- */

export const ES_SERVICES: Record<ServiceCode, EsService> = {
  VR: {
    name: 'Registro de Vehículos',
    blurb: 'Renovaciones, transferencias de título, vehículos de otro estado',
    subs: {
      renewal: 'Renovación del registro',
      transfer: 'Transferencia de título',
      outofstate: 'Vehículo de otro estado',
      duplicate: 'Título o registro duplicado'
    }
  },
  DL: {
    name: 'Licencia de Conducir',
    blurb: 'Renovaciones, reemplazos, REAL ID, solicitantes por primera vez',
    subs: {
      renewal: 'Renovación de licencia',
      replacement: 'Licencia de reemplazo',
      firsttime: 'Solicitante por primera vez',
      realid: 'Cambio a REAL ID'
    }
  }
};

export const ES_CHECKLISTS: Record<string, ChecklistItem[]> = {
  'VR:renewal': [
    { t: 'Aviso de renovación o tarjeta de registro vigente', h: 'El aviso de renovación agiliza mucho el trámite.' },
    { t: 'Prueba de seguro vigente', h: 'Debe mostrar el vehículo por VIN o placa.' },
    { t: 'Certificado de control de emisiones (smog)', h: 'No se requiere para vehículos de menos de cuatro años modelo.' },
    { t: 'Pago de las tarifas de registro', h: 'Tarjeta o cheque. Las tarifas varían según el valor del vehículo y el condado.' }
  ],
  'VR:transfer': [
    { t: 'Título del vehículo firmado', h: 'Firmado por el vendedor en el lugar correcto.' },
    { t: 'Comprobante de venta', h: 'Debe mostrar el precio y la fecha de la venta.' },
    { t: 'Lectura del odómetro', h: 'Obligatoria para vehículos de menos de diez años modelo.' },
    { t: 'Certificado de control de emisiones (smog)', h: 'Lo entrega el vendedor, salvo que esté exento.' },
    { t: 'Tarifa de transferencia e impuesto de uso', h: 'El impuesto de uso se calcula sobre el precio de compra.' }
  ],
  'VR:outofstate': [
    { t: 'Título y registro del otro estado', h: 'Ambos documentos originales.' },
    { t: 'Verificación del vehículo (REG 31)', h: 'Una inspección física del VIN.' },
    { t: 'Certificado de control de emisiones (smog)', h: 'Obligatorio para la mayoría de los vehículos que entran a California.' },
    { t: 'Certificado de peso', h: 'Solo vehículos comerciales y camionetas.' },
    { t: 'Prueba de seguro' }
  ],
  'VR:duplicate': [
    { t: 'Identificación con fotografía' },
    { t: 'Placa o VIN del vehículo' },
    { t: 'Tarifa de título duplicado' }
  ],
  'DL:renewal': [
    { t: 'Licencia de conducir de California, vigente o vencida' },
    { t: 'Pago de la tarifa de renovación' },
    { t: 'Examen de la vista', h: 'Se realiza en la ventanilla.' }
  ],
  'DL:replacement': [
    { t: 'Identificación con fotografía' },
    { t: 'Tarifa de reemplazo' }
  ],
  'DL:firsttime': [
    { t: 'Prueba de identidad', h: 'Acta de nacimiento o pasaporte vigente.' },
    { t: 'Número de seguro social', h: 'Traiga la tarjeta si la tiene.' },
    { t: 'Dos pruebas de residencia en California' },
    { t: 'Solicitud completada', h: 'Complétela en línea antes de llegar a la ventanilla.' },
    { t: 'Tarifa de solicitud' }
  ],
  'DL:realid': [
    { t: 'Una prueba de identidad', h: 'Acta de nacimiento certificada, pasaporte vigente o tarjeta de residente permanente.' },
    { t: 'Prueba del número de seguro social', h: 'Tarjeta, formulario W-2 o talón de pago con el número completo.' },
    { t: 'Dos pruebas de residencia en California', h: 'Factura de servicios, estado de cuenta o contrato de alquiler. Ambas deben mostrar su nombre y dirección.' },
    { t: 'Documentos de cambio de nombre', h: 'Solo si su nombre es distinto en los documentos anteriores.' },
    { t: 'Tarifa de solicitud' }
  ]
};

/** REG 343 section id → Spanish section title. */
export const ES_SECTIONS: Record<string, string> = {
  vehicle: 'Información del Vehículo',
  owner: 'Información del Propietario',
  legalowner: 'Propietario Legal / Acreedor Prendario',
  odometer: 'Información del Odómetro',
  dates: 'Información de Fechas',
  cost: 'Información del Costo',
  outofstate: 'Vehículos de Otro Estado o País',
  military: 'Información de Servicio Militar'
};

/** REG 343 section id → Spanish explanatory note. */
export const ES_NOTES: Record<string, string> = {
  owner: 'Cada propietario firma en papel en la ventanilla. Escriba los nombres exactamente como aparecen en su documento de identidad.',
  cost: 'El costo total debe incluir el vehículo básico, el valor de cualquier intercambio y todos los accesorios y equipos arrendados instalados de forma permanente. No incluye impuesto sobre la venta, seguro, cargos financieros ni garantía.'
};

/* field id → { label, hint, options: { English option → Spanish } }

   The option KEYS are the English values stored in form data. Never store the
   Spanish side of one of these pairs.

   Each option map carries `satisfies Record<Union, string>` against the literal
   union in lib/types.ts that defines that control's legal values. A key that is
   misspelled, or one the schema no longer offers, is a compile error — which
   matters because these strings carry punctuation that is easy to retype
   wrongly ('No — the reading…' takes an em dash, 'Kilometres' is the British
   spelling) and a near-miss key would silently fall back to English. */
export const ES_FIELDS: Record<string, EsField> = {
  vin: { label: 'Número de Identificación del Vehículo (VIN)', hint: '17 caracteres. Se encuentra en el tablero, en la base del parabrisas, o en el marco de la puerta del conductor.' },
  make: { label: 'Marca del vehículo' },
  yearModel: { label: 'Año del modelo' },
  fuelType: { label: 'Tipo de combustible', options: { Gasoline: 'Gasolina', Diesel: 'Diésel', Electric: 'Eléctrico', Hybrid: 'Híbrido', 'Flex Fuel': 'Combustible flexible', Hydrogen: 'Hidrógeno', Other: 'Otro' } satisfies Record<FuelType, string> },
  plate: { label: 'Número de placa de California', hint: 'Déjelo en blanco si este vehículo nunca ha estado registrado en California.' },
  modelSeries: { label: 'Modelo o serie' },
  bodyType: { label: 'Tipo de carrocería' },
  vehicleType: { label: 'Tipo de vehículo', options: { Auto: 'Automóvil', 'Commercial (includes truck or pickup)': 'Comercial (incluye camión o camioneta)', Motorcycle: 'Motocicleta', 'Off Highway': 'Fuera de carretera', 'Trailer Coach': 'Remolque habitable' } satisfies Record<VehicleType, string> },
  mcEngineNo: { label: 'Número de motor de la motocicleta' },
  tcLength: { label: 'Longitud del remolque (pulgadas)' },
  tcWidth: { label: 'Ancho del remolque (pulgadas)' },
  forHire: { label: '¿Se usará este vehículo para transportar personas por dinero, compensación o ganancia?', hint: 'Por ejemplo una limusina, un taxi o un autobús.', options: { Yes: 'Sí', No: 'No' } satisfies Record<YesNo, string> },
  commercial10k: { label: '¿Es un vehículo comercial que opera con 10,001 libras o más?', hint: 'Responda que sí también para una camioneta que exceda 8,001 libras sin carga y/o 11,499 libras de peso bruto vehicular.', options: { Yes: 'Sí', No: 'No' } satisfies Record<YesNo, string> },
  axles: { label: 'Número de ejes' },
  unladenWeight: { label: 'Peso sin carga (libras)' },
  unladenBasis: { label: 'Base del peso', hint: 'El peso estimado solo puede usarse para vehículos de más de 10,001 libras.', options: { Actual: 'Real', Estimated: 'Estimado' } satisfies Record<UnladenBasis, string> },

  ownerName: { label: 'Nombre completo del propietario', hint: 'Apellido, Nombre, Segundo nombre, Sufijo — o el nombre del negocio.' },
  ownerDl: { label: 'Número de licencia de conducir o tarjeta de identificación' },
  ownerDlState: { label: 'Estado' },
  hasCoOwner: { label: '¿Hay un copropietario o arrendatario?', options: { Yes: 'Sí', No: 'No' } satisfies Record<YesNo, string> },
  co1Join: { label: 'El copropietario está unido por', hint: '«AND» significa que todos los propietarios deben firmar para transferir el vehículo más adelante. «OR» significa que basta la firma de uno. Esta elección es difícil de cambiar después.', options: { AND: 'AND (y)', OR: 'OR (o)' } satisfies Record<CoOwnerJoin, string> },
  co1Name: { label: 'Nombre completo del copropietario' },
  co1Dl: { label: 'Licencia o identificación del copropietario' },
  co1DlState: { label: 'Estado' },
  physAddress: { label: 'Domicilio físico o comercial', hint: 'Incluya calle, avenida, etc. No se puede usar un apartado postal.' },
  physApt: { label: 'Apartamento / espacio / suite' },
  physCity: { label: 'Ciudad' },
  physState: { label: 'Estado' },
  physZip: { label: 'Código postal' },
  county: { label: 'Condado de residencia, o donde se guarda el vehículo' },
  equipmentNo: { label: 'Número de equipo' },
  mailDifferent: { label: '¿Su dirección postal es distinta de la anterior?', options: { Yes: 'Sí', No: 'No' } satisfies Record<YesNo, string> },
  mailAddress: { label: 'Dirección postal' },
  mailApt: { label: 'Apartamento / espacio / suite' },
  mailCity: { label: 'Ciudad' },
  mailState: { label: 'Estado' },
  mailZip: { label: 'Código postal' },
  daytimePhone: { label: 'Teléfono durante el día' },

  hasLienholder: { label: '¿Hay un acreedor prendario o titular del título sobre este vehículo?', hint: 'Un acreedor prendario es un banco o financiera con interés económico en el vehículo. Si no hay ninguno, el formulario indica «NONE».', options: { 'No lienholder': 'No hay acreedor prendario', 'Yes, there is a lienholder': 'Sí, hay un acreedor prendario' } satisfies Record<LienholderChoice, string> },
  lienName: { label: 'Nombre completo del banco, financiera o persona', hint: 'No repita el nombre del propietario registrado.' },
  eltNo: { label: 'Número de acreedor prendario electrónico (ELT)', hint: 'Debe coincidir exactamente con el listado ELT.' },
  lienAddress: { label: 'Dirección del acreedor prendario' },
  lienCity: { label: 'Ciudad' },
  lienState: { label: 'Estado' },
  lienZip: { label: 'Código postal' },

  odometerReading: { label: 'Lectura del odómetro', hint: 'Solo números enteros, sin decimales.' },
  odometerUnits: { label: 'Unidades', options: { Miles: 'Millas', Kilometres: 'Kilómetros' } satisfies Record<OdometerUnits, string> },
  odometerBasis: { label: 'Esta lectura es', options: { 'The reading on the date of purchase in California': 'La lectura en la fecha de compra en California', 'The reading as of today (no change in ownership)': 'La lectura de hoy (sin cambio de propietario)' } satisfies Record<OdometerBasis, string> },
  odometerFlag: { label: '¿Aplica alguna de estas situaciones?', options: { 'No — the reading is the actual mileage': 'No — la lectura es el millaje real', 'The reading is NOT the actual mileage': 'La lectura NO es el millaje real', 'Mileage EXCEEDS the odometer mechanical limits': 'El millaje EXCEDE el límite mecánico del odómetro' } satisfies Record<OdometerFlag, string> },
  discrepancyExplain: { label: 'Explique la discrepancia del odómetro' },

  acquiredDate: { label: 'Fecha en que se compró o adquirió el vehículo' },
  condition: { label: 'El vehículo era', options: { New: 'Nuevo', Used: 'Usado' } satisfies Record<VehicleCondition, string> },
  placeOfPurchase: { label: 'El vehículo se compró', options: { 'Inside California': 'Dentro de California', 'Outside California': 'Fuera de California' } satisfies Record<PlaceOfPurchase, string> },
  enteredCA: { label: 'Fecha en que el vehículo entró, o entrará, a California' },
  didNotOwnAtEntry: { label: 'Yo no era el dueño cuando el vehículo entró a California' },
  firstOperatedCA: { label: 'Fecha en que el vehículo circuló, o circulará, por primera vez en California' },
  residencyDate: { label: 'Fecha en que empezó a trabajar en California, obtuvo una licencia de California o se hizo residente', hint: 'Lo que haya ocurrido primero. Si ha sido residente desde su nacimiento, escriba su fecha de nacimiento.' },
  notCAResident: { label: 'No soy residente de California' },

  acquisitionMethod: { label: '¿Cómo adquirió este vehículo?', options: { Purchase: 'Compra', Gift: 'Regalo', Trade: 'Intercambio' } satisfies Record<AcquisitionMethod, string> },
  purchasePrice: { label: 'Precio de compra' },
  giftValue: { label: 'Valor actual de mercado' },
  tradeValue: { label: 'Valor al momento de adquirirlo' },
  acquiredFrom: { label: 'El vehículo se compró o adquirió de', options: { Dealer: 'Concesionario', 'Private Party': 'Particular', Dismantler: 'Desguazador', 'Immediate Family Member': 'Familiar directo' } satisfies Record<AcquiredFrom, string> },
  familyRelationship: { label: 'Indique el parentesco' },
  bodyModifications: { label: 'Desde que adquirió el vehículo, ¿se han hecho modificaciones o alteraciones a la carrocería?', hint: 'Por ejemplo, cambiar de camioneta a vehículo utilitario.', options: { Yes: 'Sí', No: 'No' } satisfies Record<YesNo, string> },

  salesTaxPaid: { label: 'Para vehículos que entran a California dentro del año siguiente a la compra: ¿se pagó impuesto sobre la venta a otro estado?', options: { 'Not applicable': 'No aplica', Yes: 'Sí', No: 'No' } satisfies Record<SalesTaxPaid, string> },
  salesTaxAmount: { label: 'Monto del impuesto pagado', hint: 'Este monto se acreditará al impuesto de uso que se deba en California.' },
  lastRegisteredAs: { label: 'En el último estado de registro, este vehículo estaba registrado como', options: { 'Commercial Vehicle': 'Vehículo comercial', 'Non-commercial Automobile': 'Automóvil no comercial' } satisfies Record<LastRegisteredAs, string> },
  plateDisposition: { label: 'Destino de las placas del otro estado', hint: 'Las placas no deben colocarse en ningún vehículo, salvo que esté registrado en ambos estados.', options: { Expired: 'Vencidas', 'Surrendered to CA DMV': 'Entregadas al DMV de California', Destroyed: 'Destruidas', Retained: 'Conservadas', 'Returned to the issuing state': 'Devueltas al estado que las emitió' } satisfies Record<PlateDisposition, string> },

  activeDuty: { label: '¿Usted o su cónyuge están en servicio activo en las Fuerzas Armadas de los Estados Unidos?', options: { Yes: 'Sí', No: 'No' } satisfies Record<YesNo, string> },
  activeDutyWhenLicensed: { label: 'Cuando este vehículo se registró por última vez, ¿estaban usted o su cónyuge en servicio activo?', options: { Yes: 'Sí', No: 'No' } satisfies Record<YesNo, string> },
  stationedWhere: { label: '¿En qué estado o país estaban destinados usted o su cónyuge?' }
};

/** Supplementary form number → Spanish title. */
export const ES_SUPPLEMENTARY: Record<string, string> = {
  'REG 4008': 'Declaración de Peso Bruto Vehicular',
  'REG 256': 'Declaración de Hechos',
  'REG 5036': 'Declaración de Construcción',
  'REG 5045': 'Exención de Tarifa de Licencia para Militares No Residentes'
};

/** English advisory sentence → Spanish. Keyed by the English text itself. */
export const ES_ADVISORIES: Record<string, string> = {
  'A Motor Carrier Permit may be required for vehicles carrying persons for hire.':
    'Puede requerirse un Permiso de Transportista para vehículos que transportan personas por dinero.'
};

/* ---- lookups used by the renderers ---------------------------------------
   Every helper takes the active language as an explicit argument. None of them
   read global state: they run inside server components, where there is no
   localStorage, no navigator and no per-request singleton to read from.

   All of them return DISPLAY text. None of them return a value to be stored.
   -------------------------------------------------------------------------- */

export function fieldLabel(field: FieldDef, lang: Lang): string {
  if (lang === 'en') return field.label;
  return ES_FIELDS[field.id]?.label ?? field.label;
}

export function fieldHint(field: FieldDef, lang: Lang): string | undefined {
  if (lang === 'en') return field.hint;
  const es = ES_FIELDS[field.id];
  /* `in` rather than `?.hint`, so a Spanish entry can deliberately carry no
     hint where the English one has one. */
  return es && 'hint' in es ? es.hint : field.hint;
}

/* `option` is the ENGLISH value stored in form data. What comes back is only
   ever shown to the customer — write `option`, not the return value. */
export function optionLabel(field: FieldDef, option: string, lang: Lang): string {
  if (lang === 'en') return option;
  return ES_FIELDS[field.id]?.options?.[option] ?? option;
}

export function sectionTitle(section: Section, lang: Lang): string {
  return lang === 'en' ? section.title : (ES_SECTIONS[section.id] ?? section.title);
}

export function sectionNote(section: Section, lang: Lang): string | undefined {
  if (lang === 'en') return section.note;
  return ES_NOTES[section.id] ?? section.note;
}

export function serviceName(code: ServiceCode, lang: Lang): string {
  return lang === 'en' ? SERVICES[code].name : ES_SERVICES[code].name;
}

export function serviceBlurb(code: ServiceCode, lang: Lang): string {
  return lang === 'en' ? SERVICES[code].blurb : ES_SERVICES[code].blurb;
}

export function subLabel(code: ServiceCode, subId: string, lang: Lang): string {
  if (lang === 'en') {
    return SERVICES[code].subs.find((s) => s.id === subId)?.label ?? subId;
  }
  return ES_SERVICES[code].subs[subId] ?? subId;
}

/* `key` is a service:sub pair such as 'VR:renewal' — the same key shape
   lib/office.ts uses. Note that office.ts exports its own English-only
   `checklistFor(service, subTransaction)`; import this one as
   `checklistFor` from '@/lib/i18n' and alias the other if a module needs both. */
export function checklistFor(key: string, lang: Lang): ChecklistItem[] {
  const english: ChecklistItem[] = CHECKLISTS[key] ?? [];
  return lang === 'en' ? english : (ES_CHECKLISTS[key] ?? english);
}

export function supplementaryTitle(form: string, title: string, lang: Lang): string {
  return lang === 'en' ? title : (ES_SUPPLEMENTARY[form] ?? title);
}

/** Advisories are keyed by their English text — there is no id to key on. */
export function advisoryText(text: string, lang: Lang): string {
  return lang === 'en' ? text : (ES_ADVISORIES[text] ?? text);
}

/* ==========================================================================
   NEWLY DRAFTED SPANISH — everything below this line

   The blocks above are ported from the legacy demo. Everything from here down
   was written for this port and has never been in front of a customer, so it
   is the first thing a certified translator should be given. The same caveat
   as the rest of the file applies with more force: DMV publishes its own
   Spanish terminology, and an error message or a wayfinding line that is
   merely comprehensible is not good enough.
   ========================================================================== */

/* ---- validation messages -------------------------------------------------

   Keyed by a stable message id rather than by the English sentence, so
   rewording the English never silently drops the Spanish. lib/reg343/
   validators.ts returns a ValidationProblem carrying { id, params, en }.

   `params` stay NUMBERS. 'You have entered 9' must interpolate 9 into a
   Spanish template at render time — a translated string with the number baked
   in would need one entry per possible count. ------------------------------ */

/* Keyed by ValidationMessageId, so a validator gaining a message it has no
   Spanish for is a compile error — the same guarantee `es` gives the UI
   dictionary. */
export const ES_VALIDATION: Record<ValidationMessageId, string> = {
  'vin.length': 'Un VIN tiene 17 caracteres. Usted escribió {n}.',
  'vin.forbiddenLetters': 'Un VIN nunca contiene las letras I, O ni Q. Revise si se trata de un 1 o un 0.',
  'vin.alphanumeric': 'Un VIN solo usa letras y números.',
  'plate.length': 'Una placa de California tiene 7 caracteres. Usted escribió {n}.',
  'plate.alphanumeric': 'Un número de placa solo usa letras y números.',
  'driverLicense.format': 'Una licencia de conducir de California es una letra seguida de siete dígitos, por ejemplo D1234567.',
  'zip.format': 'Un código postal tiene 5 dígitos, o 5 más 4.',
  'zip.notCalifornia': 'Ese código postal no es de California. Revise el código postal o el estado.',
  'address.poBox': 'Debe ser una dirección física, no un apartado postal. Puede usar un apartado postal en la dirección de correo de abajo.',
  'address.short': 'Escriba la dirección completa.',
  'address.noNumber': 'Una dirección física normalmente empieza con un número.',
  'city.short': 'Escriba el nombre completo de la ciudad.',
  'city.digits': 'El nombre de una ciudad no lleva números.',
  'city.unknownCalifornia': 'No encontramos esa ciudad en California. Revise la ortografía o el estado indicado arriba.',
  'phone.length': 'Un número de teléfono tiene 10 dígitos, incluida la clave de área.',
  'yearModel.range': 'Escriba un año entre {min} y {max}.',
  'odometer.wholeNumber': 'Escriba solo millas enteras, sin punto decimal y sin comas.',
  'currency.format': 'Escriba una cantidad, por ejemplo 18500.00',
  'date.notFuture': 'Esta fecha no puede ser futura.'
};

/* Returns null for "no problem", so the caller's `if (message)` still reads the
   same as it did when validators returned a bare string. */
export function validationMessage(
  problem: ValidationProblem | null | undefined,
  lang: Lang,
): string | null {
  if (!problem) return null;
  if (lang === 'en') return problem.en;

  const template = ES_VALIDATION[problem.id];
  if (!template) return problem.en;

  let out = template;
  for (const [name, value] of Object.entries(problem.params ?? {})) {
    out = out.split(`{${name}}`).join(String(value));
  }
  return out;
}

/* ---- office wayfinding ---------------------------------------------------

   Keyed by the English string, like ES_ADVISORIES: the offices come from a
   registry that in production is an API, so there is no id to key on and a new
   office must degrade to English rather than to nothing.

   These are the strings a customer reads INSTEAD of asking a member of staff.
   Leaving them in English asks a Spanish speaker to rejoin the queue to find
   out where the queue is. ------------------------------------------------- */

export const ES_OFFICE_HOURS: Record<string, string> = {
  'Mon – Fri, 8:00am to 5:00pm': 'Lun – Vie, de 8:00am a 5:00pm'
};

export const ES_OFFICE_LAYOUT: Record<string, string> = {
  'Windows 1–6 — Vehicle Registration': 'Ventanillas 1–6 — Registro de Vehículos',
  'Windows 7–12 — Driver License': 'Ventanillas 7–12 — Licencia de Conducir',
  'Window 13 — Knowledge tests and photos': 'Ventanilla 13 — Exámenes teóricos y fotografías',
  'Self-service terminals — by the north entrance': 'Terminales de autoservicio — junto a la entrada norte',
  'Windows 1–9 — Vehicle Registration': 'Ventanillas 1–9 — Registro de Vehículos',
  'Windows 10–18 — Driver License': 'Ventanillas 10–18 — Licencia de Conducir',
  'Windows 19–20 — Knowledge tests and photos': 'Ventanillas 19–20 — Exámenes teóricos y fotografías',
  'Behind-the-wheel tests — east parking lot': 'Exámenes de manejo — estacionamiento este',
  'Windows 1–5 — Vehicle Registration': 'Ventanillas 1–5 — Registro de Vehículos',
  'Windows 6–10 — Driver License': 'Ventanillas 6–10 — Licencia de Conducir',
  'Window 11 — Knowledge tests and photos': 'Ventanilla 11 — Exámenes teóricos y fotografías'
};

export function hoursToday(office: Office, lang: Lang): string {
  const today = office.hours.today;
  return lang === 'en' ? today : (ES_OFFICE_HOURS[today] ?? today);
}

export function layoutLines(office: Office, lang: Lang): string[] {
  if (lang === 'en') return office.layout;
  return office.layout.map((line) => ES_OFFICE_LAYOUT[line] ?? line);
}

/* ---- assistant -----------------------------------------------------------

   Spanish for the scripted answers in the demo assistant. The script is a
   stand-in for a grounded, model-backed assistant, and the two need opposite
   handling:

   SCRIPTED (today): a fixed set of answers, translated once, reviewed once by
   a translator. Safe, because a human has read every sentence that can appear.

   MODEL-BACKED (production): the language must go INTO the request, so the
   answer is GENERATED in Spanish and grounded in DMV's Spanish source pages.
   Never translate a model's English answer afterwards. Machine-translating an
   answer about which REAL ID documents are acceptable is precisely how someone
   is sent home to come back tomorrow — the failure this product exists to
   prevent — and it happens invisibly, because the Spanish reads fluently
   whether or not it is still true.

   Also note the sources: a Spanish answer must cite the Spanish DMV page. Do
   not machine-build one by splicing /es/ into an English URL; the page has to
   be confirmed to exist, by a person.
   ------------------------------------------------------------------------ */

/** Answer id → Spanish answer. Ids are shared with the English KB. */
export const ES_CHAT: Record<string, string> = {
  realid: 'Para una REAL ID necesita una prueba de identidad, prueba de su número de seguro social y <b>dos</b> pruebas distintas de residencia en California. Ambos documentos de residencia deben mostrar su nombre y la misma dirección.',
  documents: 'Depende de su trámite. Para una renovación de registro: su aviso de renovación, prueba de seguro, un certificado de smog si se requiere, y el pago. Para una transferencia de título necesita además el título firmado y un comprobante de venta.',
  smog: 'Se requiere un certificado de smog para la mayoría de los vehículos al renovar, pero no para vehículos de menos de cuatro años modelo ni para vehículos eléctricos. Los vehículos que entran a California desde otro estado casi siempre lo necesitan.',
  fees: 'Las tarifas de registro dependen del valor del vehículo, de su peso y de su condado, así que no puedo darle una cifra en la que confíe. La calculadora de tarifas del DMV da la cantidad exacta para su vehículo, y el personal puede confirmarla en la ventanilla.',
  vin: 'El VIN tiene 17 caracteres. Búsquelo en la base del parabrisas del lado del conductor, o en la etiqueta del marco de la puerta del conductor. También aparece en su tarjeta de seguro y en su registro vigente.',
  odometer: 'Escriba el número entero que muestra el odómetro, sin décimas. La lectura del odómetro se exige para vehículos de menos de diez años modelo. Si la lectura no es el millaje real, indíquelo en el formulario: es una declaración legal.',
  lien: 'Si un banco o una financiera tiene un préstamo sobre el vehículo, esa entidad es el propietario legal y debe aparecer. Si el vehículo está pagado por completo, el formulario indica «NONE»; esta aplicación se encarga de eso.',
  coowner: 'Unir a los copropietarios con <b>AND</b> significa que todos los propietarios deben firmar para vender o transferir el vehículo más adelante. <b>OR</b> significa que basta con la firma de uno solo. Es difícil de cambiar después, así que elija con cuidado.',
  whichService: 'Si se trata de un vehículo — registro, título, placas — elija Registro de Vehículos. Si se trata de usted como conductor — su licencia, una REAL ID, una tarjeta de identificación — elija Licencia de Conducir. Si necesita ambos, tome primero un turno de Licencia de Conducir; esa fila suele ser más larga.',
  missing: 'Puede tomar su lugar en la fila de todos modos, y el personal le dirá exactamente qué le falta. Pero si falta un documento obligatorio, por lo general el trámite no puede completarse hoy. Puede convenirle revisar la lista antes de esperar.',
  appointment: 'Las citas se reservan en el sitio web del DMV, no aquí. Si ya tiene una, de todos modos debe registrarse en el mostrador de entrada al llegar.',
  wait: 'Su posición en la fila y la espera estimada aparecen en la pantalla de su turno. La estimación se actualiza conforme avanzan las ventanillas.',
  signature: 'Usted firma en la ventanilla, en papel. La ley de California exige que este formulario se firme en persona bajo pena de perjurio, por lo que no se acepta una firma digital. Llenarlo aquí de todos modos le ahorra al personal escribirlo todo.',
  outOfScope: 'Eso queda fuera de lo que puedo atender: solo cubro preguntas sobre registro de vehículos y licencias de conducir para esta oficina. El personal de la ventanilla puede indicarle a dónde acudir, o dmv.ca.gov tiene la lista completa de servicios.',
  lowConfidence: 'No tengo suficiente confianza para responder eso, y una respuesta equivocada aquí podría costarle un segundo viaje. Por favor pregunte al personal cuando llamen su número.'
};

/** Source link label → Spanish. The URL is NOT translated here — see above. */
export const ES_CHAT_SOURCES: Record<string, string> = {
  'REAL ID checklist': 'Lista de documentos para REAL ID',
  'What to bring': 'Qué debe traer',
  'Smog inspections': 'Inspecciones de smog',
  'Fee calculator': 'Calculadora de tarifas',
  'Vehicle verification': 'Verificación del vehículo',
  'Odometer disclosure': 'Declaración del odómetro',
  'Titles and liens': 'Títulos y gravámenes',
  'Co-ownership': 'Copropiedad',
  'Field office services': 'Servicios de la oficina local',
  'Appointments': 'Citas',
  'Vehicle Code §1808.21': 'Código de Vehículos §1808.21'
};

/* Spanish match keywords, merged with the English list by the matcher rather
   than replacing it — 'real id' and 'smog' are what a Spanish speaker types
   too. Without these every Spanish question falls through to lowConfidence,
   which turns the assistant off for exactly the customers it was added for.

   Deliberately no bare 'and' / 'or' here: the matcher tests substrings, and
   'or' is inside por, mayor, formulario. The English list already carries them. */
export const ES_CHAT_KEYWORDS: Record<string, string[]> = {
  realid: ['real id', 'realid'],
  documents: ['documento', 'documentos', 'traer', 'llevar', 'qué necesito', 'que necesito', 'requisitos', 'lista'],
  smog: ['smog', 'emisiones', 'contaminación', 'contaminacion'],
  fees: ['tarifa', 'tarifas', 'costo', 'cuesta', 'precio', 'cuánto', 'cuanto', 'pagar', 'pago'],
  vin: ['vin', 'número de identificación', 'numero de identificacion', 'número de serie', 'numero de serie'],
  odometer: ['odómetro', 'odometro', 'millaje', 'millas', 'kilometraje'],
  lien: ['gravamen', 'acreedor', 'prendario', 'financiera', 'préstamo', 'prestamo', 'banco'],
  coowner: ['copropietario', 'copropietarios', 'ambos nombres', 'dos nombres'],
  whichService: ['qué servicio', 'que servicio', 'no estoy seguro', 'cuál fila', 'cual fila', 'dónde debo', 'donde debo'],
  missing: ['me falta', 'no tengo', 'olvidé', 'olvide', 'se me olvidó', 'se me olvido'],
  appointment: ['cita', 'citas', 'agendar', 'reservar'],
  wait: ['cuánto tiempo', 'cuanto tiempo', 'espera', 'fila', 'turno', 'demora', 'tardan'],
  signature: ['firma', 'firmar', 'firmo']
};

/* Spanish for the out-of-scope trip words. Same purpose as the English list:
   decline rather than attempt. */
export const ES_CHAT_OUT_OF_SCOPE: string[] = [
  'multa', 'citación', 'citacion', 'infracción', 'infraccion', 'corte', 'juzgado',
  'dui', 'suspendida', 'suspendido', 'puntos', 'reclamo', 'accidente', 'choque',
  'vender mi', 'comprar un', 'clima', 'chiste'
];

/** `en` is the English answer for this id — returned unchanged in English. */
export function chatAnswer(id: string, en: string, lang: Lang): string {
  return lang === 'en' ? en : (ES_CHAT[id] ?? en);
}

export function chatSourceLabel(label: string, lang: Lang): string {
  return lang === 'en' ? label : (ES_CHAT_SOURCES[label] ?? label);
}

/* The keywords to test for an answer id in this language: English always, plus
   Spanish when the customer is reading Spanish. */
export function chatKeywords(id: string, englishKeywords: readonly string[], lang: Lang): string[] {
  if (lang === 'en') return [...englishKeywords];
  return [...englishKeywords, ...(ES_CHAT_KEYWORDS[id] ?? [])];
}

export function outOfScopeKeywords(englishKeywords: readonly string[], lang: Lang): string[] {
  if (lang === 'en') return [...englishKeywords];
  return [...englishKeywords, ...ES_CHAT_OUT_OF_SCOPE];
}

/* ---- review screen -------------------------------------------------------

   formatProblems() returns the English `label` and `section` alongside the
   structured problem, so a Spanish review screen listing "3 respuestas parecen
   incorrectas" would otherwise name each one in English. These two resolve
   those back through the schema.

   Note the two ids in a FormatProblem: `id` is the FIELD ('vin') and
   `problem.id` is the MESSAGE ('vin.length'). ------------------------------ */

const SECTION_ID_BY_TITLE = new Map(REG343.map((s) => [s.title, s.id]));

export function problemFieldLabel(problem: FormatProblem, lang: Lang): string {
  if (lang === 'en') return problem.label;
  const field = fieldById(problem.id);
  return field ? fieldLabel(field, lang) : problem.label;
}

export function problemSectionTitle(problem: FormatProblem, lang: Lang): string {
  if (lang === 'en') return problem.section;
  const sectionId = SECTION_ID_BY_TITLE.get(problem.section);
  return (sectionId && ES_SECTIONS[sectionId]) || problem.section;
}

/* ---- drift guard ---------------------------------------------------------

   ES_OFFICE_LAYOUT and ES_OFFICE_HOURS are keyed by English prose, because the
   office registry has no ids for these lines. That is safe — an unknown string
   falls back to English — but it is silent: change 'Windows 1–6' to
   'Windows 1–7' and the Spanish reverts with nothing to notice it.

   So make it noticeable. Assert this is empty in a test, or log it in dev.
   Returns every office string with no Spanish translation. ---------------- */

export function untranslatedOfficeStrings(offices: readonly Office[]): string[] {
  const missing: string[] = [];
  for (const office of offices) {
    if (!(office.hours.today in ES_OFFICE_HOURS)) missing.push(office.hours.today);
    for (const line of office.layout) {
      if (!(line in ES_OFFICE_LAYOUT)) missing.push(line);
    }
  }
  return missing;
}

/* Dev-only, and deliberately a warning rather than a throw: the failure is one
   wayfinding line reverting to English, not a broken app, and a hard throw
   would block unrelated English-only work until someone fixed the Spanish.
   Loud enough to be seen the moment a dash is retyped; a test asserting
   untranslatedOfficeStrings() is empty is what keeps it out of a release. */
if (process.env.NODE_ENV !== 'production') {
  const missing = untranslatedOfficeStrings(Object.values(OFFICES));
  if (missing.length) {
    console.error(
      `[i18n] ${missing.length} office string(s) have no Spanish and will show in English:\n` +
        missing.map((m) => `  ${JSON.stringify(m)}`).join('\n') +
        '\nCheck the dashes: layout lines use an en dash (–, U+2013) in ranges and an em dash (—, U+2014) before the description.',
    );
  }
}
