/* ==========================================================================
   REG 343 PDF fill — writes captured answers into the real DMV AcroForm
   and downloads the result.

   Source: forms/REG-343_Application_for_Title_or_Registration_Rev-4-2021.pdf
   (REV. 4/2021 CORRECTED, 363 form fields).

   Field names in the DMV form are largely generic (Text62, "Yes No 2"), and
   radio-group export values are long accessibility sentences. Rather than
   hard-coding those strings, radio options are selected by widget POSITION —
   sorted top-to-bottom then left-to-right — which is how each control was
   identified against the rendered form.
   ========================================================================== */

/* The PDF DMV publishes carries an owner (permissions) password with an empty
   user password. Browser PDF writers cannot read its encrypted object streams,
   so a decrypted fill template is produced once, offline, from the official
   file. Content, fields and layout are unchanged — only the "restrict editing"
   flag is removed. See forms/README.md. */
const REG343_PDF_URL = '../forms/REG-343_fill-template.pdf';

/* ---- helpers ------------------------------------------------------------ */

function setText(form, name, value) {
  if (value === undefined || value === null || String(value).trim() === '') return;
  try { form.getTextField(name).setText(String(value)); }
  catch (e) { console.warn('[reg343] no text field', name); }
}

/* Spread a string across a run of single-character comb boxes. */
function setComb(form, names, value) {
  if (!value) return;
  const chars = String(value).toUpperCase().replace(/\s+/g, '');
  names.forEach((n, i) => { if (chars[i]) setText(form, n, chars[i]); });
}

function checkBox(form, name, on) {
  if (!on) return;
  try { form.getCheckBox(name).check(); }
  catch (e) { console.warn('[reg343] no checkbox', name); }
}

/* Turn on the nth option of a multi-widget button field, ordered by position
   on the page.

   These controls are NOT PDF radio groups: the DMV form uses checkbox fields
   that share one name across several widgets, each with its own long export
   value. pdf-lib's getRadioGroup() therefore rejects them, so the widgets are
   driven directly — appearance state on the chosen one, /Off on its siblings,
   and the field value set to the chosen export name.

   Rows are bucketed to 5pt so widgets sharing a visual line are not reordered
   by a one-point difference in their rectangles. */
function selectByPosition(form, fieldName, index) {
  if (index === null || index === undefined || index < 0) return;

  const { PDFName } = PDFLib;
  const field = form.getFields().find(f => f.getName() === fieldName);
  if (!field) { console.warn('[reg343] no field', fieldName); return; }

  const widgets = field.acroField.getWidgets().map(w => {
    const r = w.getRectangle();
    return { w, row: Math.round(r.y / 5), x: r.x };
  });
  widgets.sort((a, b) => (b.row - a.row) || (a.x - b.x));

  const target = widgets[index];
  if (!target) { console.warn('[reg343]', fieldName, 'has no option', index); return; }

  const on = target.w.getOnValue();
  if (!on) { console.warn('[reg343] no on-state for', fieldName, index); return; }

  widgets.forEach(o => o.w.setAppearanceState(o === target ? on : PDFName.of('Off')));
  field.acroField.dict.set(PDFName.of('V'), on);
}

/* ---- the mapping -------------------------------------------------------- */

const VIN_CELLS = Array.from({ length: 18 }, (_, i) => `Text9.${i + 1}`);
const OWNER_DL_CELLS = ['Owner DL no', 'owner second digit', 'owner third digit', 'owner fourth digit',
  'owner fifth digit', 'owner sixth digit', 'owner seventh digit', 'owner eighth digit'];
const CO1_DL_CELLS = ['first co owner dl no', 'first co owner second digit', 'first co owner third digit',
  'first co owner fourth digit', 'first co owner fifth digit', 'first co owner sixth digit',
  'first co owner seventh digit', 'first co owner eighth digit'];
const ODO_CELLS = ['Text132.0', 'Text132.1', 'Text132.2', 'Text132.3', 'Text132.4', 'Text132.5'];

const VEHICLE_TYPE_INDEX = {
  'Auto': 0, 'Commercial (includes truck or pickup)': 1, 'Motorcycle': 2,
  'Off Highway': 3, 'Trailer Coach': 4
};
const ACQUIRED_FROM_INDEX = { 'Dealer': 0, 'Private Party': 1, 'Dismantler': 2, 'Immediate Family Member': 3 };
const METHOD_INDEX = { 'Purchase': 0, 'Gift': 1, 'Trade': 2 };
const PLATE_INDEX = { 'Surrendered to CA DMV': 0, 'Destroyed': 1, 'Retained': 2, 'Returned to the issuing state': 3 };

const yesNo = v => v === 'Yes' ? 0 : v === 'No' ? 1 : null;

/* Split an ISO date into month / day / year parts */
function dateParts(iso) {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return { y: m[1], m: m[2], d: m[3] };
}

function fillDate(form, iso, mField, dField, yField) {
  const p = dateParts(iso);
  if (!p) return;
  setText(form, mField, p.m);
  setText(form, dField, p.d);
  setText(form, yField, p.y);
}

/* Right-align the odometer reading across its six comb cells */
function fillOdometer(form, reading) {
  if (!reading) return;
  const digits = String(reading).replace(/\D/g, '').slice(-6);
  const padded = digits.padStart(6, '');
  const offset = ODO_CELLS.length - digits.length;
  digits.split('').forEach((ch, i) => setText(form, ODO_CELLS[offset + i], ch));
  return padded;
}

/* ---- main --------------------------------------------------------------- */

async function fillREG343(data, meta) {
  const { PDFDocument } = PDFLib;

  const bytes = await fetch(REG343_PDF_URL).then(r => {
    if (!r.ok) throw new Error('Could not load the REG 343 form (' + r.status + ')');
    return r.arrayBuffer();
  });

  /* The DMV form carries a permissions (owner) password with an empty user
     password — a "restrict editing" flag on a publicly distributed fillable
     form, not access protection. Loading past it is required to fill it. */
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = pdf.getForm();
  const d = data || {};

  /* --- Section 1: vehicle ------------------------------------------------ */
  setComb(form, VIN_CELLS, d.vin);
  setText(form, 'Text10', d.make);
  setText(form, 'Text11', d.yearModel);
  setText(form, 'Text12', d.fuelType);
  setText(form, 'Text13', d.plate);
  setText(form, 'Text16', d.modelSeries);
  setText(form, 'Text17', d.bodyType);
  setText(form, 'Text18', d.mcEngineNo);
  selectByPosition(form, 'Type of Vehicle', VEHICLE_TYPE_INDEX[d.vehicleType]);
  setText(form, 'Text29', d.tcLength);
  setText(form, 'Text30', d.tcWidth);
  selectByPosition(form, 'Yes No', yesNo(d.forHire));
  selectByPosition(form, 'YES NO', yesNo(d.commercial10k));
  setText(form, 'Text49', d.axles);
  setText(form, 'Text50', d.unladenWeight);
  selectByPosition(form, 'Commercial Vehicles Only',
    d.unladenBasis === 'Actual' ? 0 : d.unladenBasis === 'Estimated' ? 1 : null);

  /* --- Section 2: owner -------------------------------------------------- */
  setText(form, 'Text62', d.ownerName);
  setComb(form, OWNER_DL_CELLS, d.ownerDl);
  setText(form, 'Text64', d.ownerDlState);

  if (d.hasCoOwner === 'Yes') {
    setText(form, 'Text73', d.co1Name);
    setComb(form, CO1_DL_CELLS, d.co1Dl);
    setText(form, 'Text74', d.co1DlState);
    selectByPosition(form, 'And Or', d.co1Join === 'AND' ? 0 : d.co1Join === 'OR' ? 1 : null);
  }

  setText(form, 'Text82', d.physAddress);
  setText(form, 'Text83', d.physApt);
  setText(form, 'Text85', d.physCity);
  setText(form, 'Text86', d.physState);
  setText(form, 'Text87', d.physZip);
  setText(form, 'Text88', d.county);
  setText(form, 'Text89', d.equipmentNo);

  if (d.mailDifferent === 'Yes') {
    setText(form, 'Text90', d.mailAddress);
    setText(form, 'Text91', d.mailApt);
    setText(form, 'Text92', d.mailCity);
    setText(form, 'Text93', d.mailState);
    setText(form, 'Text94', d.mailZip);
  }

  /* --- Section 3: legal owner -------------------------------------------- */
  const hasLien = d.hasLienholder === 'Yes, there is a lienholder';
  setText(form, 'Text118', hasLien ? d.lienName : 'NONE');
  if (hasLien) {
    setText(form, 'Text119', d.eltNo);
    setText(form, 'Text120', d.lienAddress);
    setText(form, 'Text122', d.lienCity);
    setText(form, 'Text123', d.lienState);
    setText(form, 'Text124', d.lienZip);
  }

  /* --- Section 4: odometer ----------------------------------------------- */
  fillOdometer(form, d.odometerReading);
  checkBox(form, 'Check Box133', d.odometerUnits === 'Kilometres');
  selectByPosition(form, 'Odometer Reading',
    d.odometerBasis === 'The reading on the date of purchase in California' ? 0
      : d.odometerBasis === 'The reading as of today (no change in ownership)' ? 1 : null);
  if (d.odometerFlag === 'The reading is NOT the actual mileage') selectByPosition(form, 'Odometer Discrepancy', 0);
  if (d.odometerFlag === 'Mileage EXCEEDS the odometer mechanical limits') selectByPosition(form, 'Odometer Discrepancy', 1);
  setText(form, 'Text136', d.discrepancyExplain);

  /* --- Section 5: dates -------------------------------------------------- */
  fillDate(form, d.enteredCA, 'Text137', 'Text138', 'Text139');
  checkBox(form, 'Check Box140', d.didNotOwnAtEntry === true);
  fillDate(form, d.firstOperatedCA, 'Text141', 'Text142', 'Text143');
  fillDate(form, d.residencyDate, 'Text144', 'Text145', 'Text146');
  checkBox(form, 'Check Box151', d.notCAResident === true);
  fillDate(form, d.acquiredDate, 'Text147', 'Text148', 'Text149');
  selectByPosition(form, 'New Used', d.condition === 'New' ? 0 : d.condition === 'Used' ? 1 : null);
  selectByPosition(form, 'Inside Outside',
    d.placeOfPurchase === 'Inside California' ? 0 : d.placeOfPurchase === 'Outside California' ? 1 : null);

  /* --- Section 6: cost --------------------------------------------------- */
  selectByPosition(form, 'Purchase Gift Trade', METHOD_INDEX[d.acquisitionMethod]);
  setText(form, 'Text156', d.purchasePrice);
  setText(form, 'Text158', d.giftValue);
  setText(form, 'Text160', d.tradeValue);
  selectByPosition(form, 'Acquired from', ACQUIRED_FROM_INDEX[d.acquiredFrom]);
  setText(form, 'Text165', d.familyRelationship);
  selectByPosition(form, 'Yes No 2', yesNo(d.bodyModifications));

  /* --- Section 7: out of state ------------------------------------------- */
  selectByPosition(form, 'NA Yes No',
    d.salesTaxPaid === 'Not applicable' ? 0 : d.salesTaxPaid === 'Yes' ? 1 : d.salesTaxPaid === 'No' ? 2 : null);
  setText(form, 'Text172', d.salesTaxAmount);
  selectByPosition(form, 'Last Registered',
    d.lastRegisteredAs === 'Commercial Vehicle' ? 0 : d.lastRegisteredAs === 'Non-commercial Automobile' ? 1 : null);
  if (d.plateDisposition === 'Expired') checkBox(form, 'Check Box175', true);
  else selectByPosition(form, 'Expired or will be or were', PLATE_INDEX[d.plateDisposition]);

  /* --- Section 8: military ----------------------------------------------- */
  selectByPosition(form, 'Yes No 3', yesNo(d.activeDuty));
  selectByPosition(form, 'Yes No 4', yesNo(d.activeDutyWhenLicensed));
  setText(form, 'Text19', d.stationedWhere);

  /* --- Section 9: certifications ----------------------------------------
     Signature and date are deliberately left blank — they are executed on
     paper at the counter under penalty of perjury (CVC §1808.21).
     Printed name and telephone are pre-filled to save keying.            */
  setText(form, 'Text184', d.ownerName);
  const phone = String(d.daytimePhone || '').replace(/\D/g, '');
  if (phone.length === 10) {
    setText(form, 'Text186', phone.slice(0, 3));
    setText(form, 'Text187', phone.slice(3, 6) + '-' + phone.slice(6));
  } else if (phone) {
    setText(form, 'Text187', d.daytimePhone);
  }
  if (d.hasCoOwner === 'Yes') setText(form, 'Text188', d.co1Name);

  /* Keep the form editable so the technician can correct at the counter.
     Appearances are generated now so every viewer renders the values. */
  form.updateFieldAppearances();

  const out = await pdf.save();
  return { bytes: out, filename: `REG343_${(meta && meta.token) || 'application'}.pdf` };
}

async function downloadREG343(data, meta) {
  const { bytes, filename } = await fillREG343(data, meta);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return filename;
}
