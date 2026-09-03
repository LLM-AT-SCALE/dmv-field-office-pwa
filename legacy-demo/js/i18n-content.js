/* ==========================================================================
   Spanish content — services, checklists and the REG 343 form

   Field labels are translated for COMPREHENSION only. The data the customer
   enters is written into the English legal form unchanged, because REG 343 is
   an English document filed with the State. A Spanish speaker understands what
   is being asked; DMV receives the form it expects.

   Working drafts. A certified translator must review before pilot — DMV
   publishes its own Spanish terminology for these fields.
   ========================================================================== */

const ES_SERVICES = {
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

const ES_CHECKLISTS = {
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

const ES_SECTIONS = {
  vehicle: 'Información del Vehículo',
  owner: 'Información del Propietario',
  legalowner: 'Propietario Legal / Acreedor Prendario',
  odometer: 'Información del Odómetro',
  dates: 'Información de Fechas',
  cost: 'Información del Costo',
  outofstate: 'Vehículos de Otro Estado o País',
  military: 'Información de Servicio Militar'
};

const ES_NOTES = {
  owner: 'Cada propietario firma en papel en la ventanilla. Escriba los nombres exactamente como aparecen en su documento de identidad.',
  cost: 'El costo total debe incluir el vehículo básico, el valor de cualquier intercambio y todos los accesorios y equipos arrendados instalados de forma permanente. No incluye impuesto sobre la venta, seguro, cargos financieros ni garantía.'
};

/* field id → { label, hint, options: { English option → Spanish } } */
const ES_FIELDS = {
  vin: { label: 'Número de Identificación del Vehículo (VIN)', hint: '17 caracteres. Se encuentra en el tablero, en la base del parabrisas, o en el marco de la puerta del conductor.' },
  make: { label: 'Marca del vehículo' },
  yearModel: { label: 'Año del modelo' },
  fuelType: { label: 'Tipo de combustible', options: { Gasoline: 'Gasolina', Diesel: 'Diésel', Electric: 'Eléctrico', Hybrid: 'Híbrido', 'Flex Fuel': 'Combustible flexible', Hydrogen: 'Hidrógeno', Other: 'Otro' } },
  plate: { label: 'Número de placa de California', hint: 'Déjelo en blanco si este vehículo nunca ha estado registrado en California.' },
  modelSeries: { label: 'Modelo o serie' },
  bodyType: { label: 'Tipo de carrocería' },
  vehicleType: { label: 'Tipo de vehículo', options: { Auto: 'Automóvil', 'Commercial (includes truck or pickup)': 'Comercial (incluye camión o camioneta)', Motorcycle: 'Motocicleta', 'Off Highway': 'Fuera de carretera', 'Trailer Coach': 'Remolque habitable' } },
  mcEngineNo: { label: 'Número de motor de la motocicleta' },
  tcLength: { label: 'Longitud del remolque (pulgadas)' },
  tcWidth: { label: 'Ancho del remolque (pulgadas)' },
  forHire: { label: '¿Se usará este vehículo para transportar personas por dinero, compensación o ganancia?', hint: 'Por ejemplo una limusina, un taxi o un autobús.', options: { Yes: 'Sí', No: 'No' } },
  commercial10k: { label: '¿Es un vehículo comercial que opera con 10,001 libras o más?', hint: 'Responda que sí también para una camioneta que exceda 8,001 libras sin carga y/o 11,499 libras de peso bruto vehicular.', options: { Yes: 'Sí', No: 'No' } },
  axles: { label: 'Número de ejes' },
  unladenWeight: { label: 'Peso sin carga (libras)' },
  unladenBasis: { label: 'Base del peso', hint: 'El peso estimado solo puede usarse para vehículos de más de 10,001 libras.', options: { Actual: 'Real', Estimated: 'Estimado' } },

  ownerName: { label: 'Nombre completo del propietario', hint: 'Apellido, Nombre, Segundo nombre, Sufijo — o el nombre del negocio.' },
  ownerDl: { label: 'Número de licencia de conducir o tarjeta de identificación' },
  ownerDlState: { label: 'Estado' },
  hasCoOwner: { label: '¿Hay un copropietario o arrendatario?', options: { Yes: 'Sí', No: 'No' } },
  co1Join: { label: 'El copropietario está unido por', hint: '«AND» significa que todos los propietarios deben firmar para transferir el vehículo más adelante. «OR» significa que basta la firma de uno. Esta elección es difícil de cambiar después.', options: { AND: 'AND (y)', OR: 'OR (o)' } },
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
  mailDifferent: { label: '¿Su dirección postal es distinta de la anterior?', options: { Yes: 'Sí', No: 'No' } },
  mailAddress: { label: 'Dirección postal' },
  mailApt: { label: 'Apartamento / espacio / suite' },
  mailCity: { label: 'Ciudad' },
  mailState: { label: 'Estado' },
  mailZip: { label: 'Código postal' },
  daytimePhone: { label: 'Teléfono durante el día' },

  hasLienholder: { label: '¿Hay un acreedor prendario o titular del título sobre este vehículo?', hint: 'Un acreedor prendario es un banco o financiera con interés económico en el vehículo. Si no hay ninguno, el formulario indica «NONE».', options: { 'No lienholder': 'No hay acreedor prendario', 'Yes, there is a lienholder': 'Sí, hay un acreedor prendario' } },
  lienName: { label: 'Nombre completo del banco, financiera o persona', hint: 'No repita el nombre del propietario registrado.' },
  eltNo: { label: 'Número de acreedor prendario electrónico (ELT)', hint: 'Debe coincidir exactamente con el listado ELT.' },
  lienAddress: { label: 'Dirección del acreedor prendario' },
  lienCity: { label: 'Ciudad' },
  lienState: { label: 'Estado' },
  lienZip: { label: 'Código postal' },

  odometerReading: { label: 'Lectura del odómetro', hint: 'Solo números enteros, sin decimales.' },
  odometerUnits: { label: 'Unidades', options: { Miles: 'Millas', Kilometres: 'Kilómetros' } },
  odometerBasis: { label: 'Esta lectura es', options: { 'The reading on the date of purchase in California': 'La lectura en la fecha de compra en California', 'The reading as of today (no change in ownership)': 'La lectura de hoy (sin cambio de propietario)' } },
  odometerFlag: { label: '¿Aplica alguna de estas situaciones?', options: { 'No — the reading is the actual mileage': 'No — la lectura es el millaje real', 'The reading is NOT the actual mileage': 'La lectura NO es el millaje real', 'Mileage EXCEEDS the odometer mechanical limits': 'El millaje EXCEDE el límite mecánico del odómetro' } },
  discrepancyExplain: { label: 'Explique la discrepancia del odómetro' },

  acquiredDate: { label: 'Fecha en que se compró o adquirió el vehículo' },
  condition: { label: 'El vehículo era', options: { New: 'Nuevo', Used: 'Usado' } },
  placeOfPurchase: { label: 'El vehículo se compró', options: { 'Inside California': 'Dentro de California', 'Outside California': 'Fuera de California' } },
  enteredCA: { label: 'Fecha en que el vehículo entró, o entrará, a California' },
  didNotOwnAtEntry: { label: 'Yo no era el dueño cuando el vehículo entró a California' },
  firstOperatedCA: { label: 'Fecha en que el vehículo circuló, o circulará, por primera vez en California' },
  residencyDate: { label: 'Fecha en que empezó a trabajar en California, obtuvo una licencia de California o se hizo residente', hint: 'Lo que haya ocurrido primero. Si ha sido residente desde su nacimiento, escriba su fecha de nacimiento.' },
  notCAResident: { label: 'No soy residente de California' },

  acquisitionMethod: { label: '¿Cómo adquirió este vehículo?', options: { Purchase: 'Compra', Gift: 'Regalo', Trade: 'Intercambio' } },
  purchasePrice: { label: 'Precio de compra' },
  giftValue: { label: 'Valor actual de mercado' },
  tradeValue: { label: 'Valor al momento de adquirirlo' },
  acquiredFrom: { label: 'El vehículo se compró o adquirió de', options: { Dealer: 'Concesionario', 'Private Party': 'Particular', Dismantler: 'Desguazador', 'Immediate Family Member': 'Familiar directo' } },
  familyRelationship: { label: 'Indique el parentesco' },
  bodyModifications: { label: 'Desde que adquirió el vehículo, ¿se han hecho modificaciones o alteraciones a la carrocería?', hint: 'Por ejemplo, cambiar de camioneta a vehículo utilitario.', options: { Yes: 'Sí', No: 'No' } },

  salesTaxPaid: { label: 'Para vehículos que entran a California dentro del año siguiente a la compra: ¿se pagó impuesto sobre la venta a otro estado?', options: { 'Not applicable': 'No aplica', Yes: 'Sí', No: 'No' } },
  salesTaxAmount: { label: 'Monto del impuesto pagado', hint: 'Este monto se acreditará al impuesto de uso que se deba en California.' },
  lastRegisteredAs: { label: 'En el último estado de registro, este vehículo estaba registrado como', options: { 'Commercial Vehicle': 'Vehículo comercial', 'Non-commercial Automobile': 'Automóvil no comercial' } },
  plateDisposition: { label: 'Destino de las placas del otro estado', hint: 'Las placas no deben colocarse en ningún vehículo, salvo que esté registrado en ambos estados.', options: { Expired: 'Vencidas', 'Surrendered to CA DMV': 'Entregadas al DMV de California', Destroyed: 'Destruidas', Retained: 'Conservadas', 'Returned to the issuing state': 'Devueltas al estado que las emitió' } },

  activeDuty: { label: '¿Usted o su cónyuge están en servicio activo en las Fuerzas Armadas de los Estados Unidos?', options: { Yes: 'Sí', No: 'No' } },
  activeDutyWhenLicensed: { label: 'Cuando este vehículo se registró por última vez, ¿estaban usted o su cónyuge en servicio activo?', options: { Yes: 'Sí', No: 'No' } },
  stationedWhere: { label: '¿En qué estado o país estaban destinados usted o su cónyuge?' }
};

const ES_SUPPLEMENTARY = {
  'REG 4008': 'Declaración de Peso Bruto Vehicular',
  'REG 256': 'Declaración de Hechos',
  'REG 5036': 'Declaración de Construcción',
  'REG 5045': 'Exención de Tarifa de Licencia para Militares No Residentes'
};

const ES_ADVISORIES = {
  'A Motor Carrier Permit may be required for vehicles carrying persons for hire.':
    'Puede requerirse un Permiso de Transportista para vehículos que transportan personas por dinero.'
};

/* ---- lookups used by the renderers -------------------------------------- */

function fieldLabel(field) {
  if (currentLang() === 'en') return field.label;
  return ES_FIELDS[field.id]?.label || field.label;
}
function fieldHint(field) {
  if (currentLang() === 'en') return field.hint;
  const es = ES_FIELDS[field.id];
  return (es && 'hint' in es) ? es.hint : field.hint;
}
function optionLabel(field, option) {
  if (currentLang() === 'en') return option;
  return ES_FIELDS[field.id]?.options?.[option] || option;
}
function sectionTitle(section) {
  return currentLang() === 'en' ? section.title : (ES_SECTIONS[section.id] || section.title);
}
function sectionNote(section) {
  if (currentLang() === 'en') return section.note;
  return ES_NOTES[section.id] || section.note;
}
function serviceName(code) {
  return currentLang() === 'en' ? SERVICES[code].name : ES_SERVICES[code].name;
}
function serviceBlurb(code) {
  return currentLang() === 'en' ? SERVICES[code].blurb : ES_SERVICES[code].blurb;
}
function subLabel(code, subId) {
  if (currentLang() === 'en') return SERVICES[code].subs.find(s => s.id === subId)?.label || subId;
  return ES_SERVICES[code].subs[subId] || subId;
}
function checklistFor(key) {
  return currentLang() === 'en' ? (CHECKLISTS[key] || []) : (ES_CHECKLISTS[key] || CHECKLISTS[key] || []);
}
function supplementaryTitle(form, title) {
  return currentLang() === 'en' ? title : (ES_SUPPLEMENTARY[form] || title);
}
function advisoryText(text) {
  return currentLang() === 'en' ? text : (ES_ADVISORIES[text] || text);
}
