/* ==========================================================================
   Assistant — scripted demo stand-in for the grounded Claude-backed chatbot.
   Demonstrates the safety rules from the PRD §9.4:
     · answers only from DMV-published content
     · every substantive answer carries a source link
     · out-of-scope questions are declined, not attempted
     · no fee figures beyond the grounded set, no eligibility determinations
   ========================================================================== */

const DMV = 'https://www.dmv.ca.gov';

const KB = [
  { k: ['real id', 'realid'],
    a: 'For a REAL ID you need one proof of identity, proof of your social security number, and <b>two</b> different proofs of California residency. Both residency documents must show your name and the same address.',
    s: ['REAL ID checklist', DMV + '/portal/driver-licenses-identification-cards/real-id/'] },

  { k: ['document', 'bring', 'need', 'checklist'],
    a: 'It depends on your transaction. For a registration renewal: your renewal notice, proof of insurance, a smog certificate if required, and payment. For a title transfer you also need the signed title and a bill of sale.',
    s: ['What to bring', DMV + '/portal/vehicle-registration/'] },

  { k: ['smog'],
    a: 'A smog certificate is required for most vehicles at renewal, but not for vehicles under four model years old, and not for electric vehicles. Vehicles entering California from another state almost always need one.',
    s: ['Smog inspections', DMV + '/portal/vehicle-registration/smog-inspections/'] },

  { k: ['fee', 'cost', 'price', 'how much', 'pay'],
    a: 'Registration fees depend on the vehicle value, its weight, and your county — so I cannot quote you a figure I would trust. The DMV fee calculator gives an exact amount for your vehicle, and the technician can confirm it at the counter.',
    s: ['Fee calculator', DMV + '/portal/vehicle-registration/registration-fees/'] },

  { k: ['vin', 'identification number'],
    a: 'The VIN is 17 characters. Look at the base of the windscreen on the driver side, or on the sticker inside the driver door frame. It is also printed on your insurance card and your current registration.',
    s: ['Vehicle verification', DMV + '/portal/vehicle-registration/'] },

  { k: ['odometer', 'mileage'],
    a: 'Enter the whole number shown on the odometer, without tenths. An odometer reading is required for vehicles under ten model years old. If the reading is not the true mileage, say so on the form — that is a legal declaration.',
    s: ['Odometer disclosure', DMV + '/portal/vehicle-registration/titles/'] },

  { k: ['lien', 'lienholder', 'finance', 'loan'],
    a: 'If a bank or finance company holds a loan on the vehicle, they are the legal owner and must be listed. If the vehicle is paid off outright, the form records "NONE" — this app handles that for you.',
    s: ['Titles and liens', DMV + '/portal/vehicle-registration/titles/'] },

  { k: ['and', 'or', 'co-owner', 'coowner', 'joint'],
    a: 'Joining co-owners with <b>AND</b> means every owner must sign to sell or transfer the vehicle later. <b>OR</b> means any single owner can sign alone. It is difficult to change afterwards, so choose deliberately.',
    s: ['Co-ownership', DMV + '/portal/vehicle-registration/titles/'] },

  { k: ['which service', 'not sure', 'dl or vr', 'right queue'],
    a: 'If it concerns a vehicle — registration, title, plates — choose Vehicle Registration. If it concerns you as a driver — your licence, a REAL ID, an identification card — choose Driver License. If you need both, take a Driver License ticket first; that queue is usually longer.',
    s: ['Field office services', DMV + '/portal/field-office/'] },

  { k: ['missing', 'do not have', "don't have", 'forgot'],
    a: 'You can still join the queue, and the technician will tell you exactly what is outstanding. But if a required document is missing, the transaction usually cannot be completed today. It may be worth checking the list before you wait.',
    s: ['What to bring', DMV + '/portal/field-office/'] },

  { k: ['appointment', 'book'],
    a: 'Appointments are booked on the DMV website rather than here. If you already have one, you still check in at the front desk when you arrive.',
    s: ['Appointments', DMV + '/portal/appointments/'] },

  { k: ['how long', 'wait', 'queue', 'busy'],
    a: 'Your live position and estimated wait are shown on your ticket screen. The estimate updates as the counters move.',
    s: null },

  { k: ['sign', 'signature'],
    a: 'You sign at the counter, on paper. California law requires this form to be signed in person under penalty of perjury, so a digital signature is not accepted. Filling it in here still saves the technician keying it all in.',
    s: ['Vehicle Code §1808.21', DMV + '/portal/vehicle-registration/'] }
];

const OUT_OF_SCOPE = [
  'ticket', 'citation', 'fine', 'court', 'dui', 'suspend', 'suspended', 'point',
  'insurance claim', 'accident', 'crash', 'sell my', 'buy a car', 'weather', 'joke'
];

function answerFor(q) {
  const t = q.toLowerCase().trim();
  if (!t) return null;

  if (OUT_OF_SCOPE.some(w => t.includes(w))) {
    return {
      a: 'That falls outside what I can help with — I only cover vehicle registration and driver licence questions for this office. The technician at the counter can point you to the right place, or dmv.ca.gov has the full range of services.',
      s: null
    };
  }

  let best = null, bestScore = 0;
  KB.forEach(entry => {
    const score = entry.k.reduce((n, k) => t.includes(k) ? n + k.length : n, 0);
    if (score > bestScore) { bestScore = score; best = entry; }
  });

  if (!best) {
    return {
      a: 'I am not confident enough to answer that one, and a wrong answer here could cost you a second trip. Please ask the technician when your number is called.',
      s: null
    };
  }
  return best;
}

/* ---------- UI ---------- */

const chatSheet = () => document.querySelector('#chatSheet');
const chatLog = () => document.querySelector('#chatLog');

let lastFocus = null;

function openChat() {
  lastFocus = document.activeElement;
  chatSheet().classList.add('open');
  chatSheet().removeAttribute('aria-hidden');
  document.querySelector('#scrim').classList.add('on');
  document.querySelector('#chatInput').focus();
}

function closeChat() {
  chatSheet().classList.remove('open');
  chatSheet().setAttribute('aria-hidden', 'true');
  document.querySelector('#scrim').classList.remove('on');
  /* Return focus to whatever opened the panel, so a keyboard user is not
     dropped back at the top of the document. */
  lastFocus?.focus?.();
  lastFocus = null;
}

/* Keep Tab inside the panel while it is open — it is a modal dialog. */
function trapFocus(e) {
  if (e.key !== 'Tab') return;
  const sheet = chatSheet();
  if (!sheet.classList.contains('open')) return;
  const items = [...sheet.querySelectorAll('button, input, a[href]')].filter(el => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function bubble(text, who, source) {
  const d = document.createElement('div');
  d.className = 'msg ' + who;
  d.innerHTML = text + (source ? `<span class="source">${t('chat.source')}: <a href="${source[1]}" target="_blank" rel="noopener">${source[0]} ↗</a></span>` : '');
  chatLog().appendChild(d);
  chatLog().scrollTop = chatLog().scrollHeight;
}

function ask(q) {
  bubble(escapeHtml(q), 'me');
  const r = answerFor(q);
  setTimeout(() => bubble(r.a, 'bot', r.s), 320);
}

function initChat() {
  document.querySelector('#chatFab').addEventListener('click', openChat);
  document.querySelector('#chatClose').addEventListener('click', closeChat);
  document.querySelector('#scrim').addEventListener('click', closeChat);

  document.querySelector('#chatForm').addEventListener('submit', e => {
    e.preventDefault();
    const input = document.querySelector('#chatInput');
    const v = input.value.trim();
    if (!v) return;
    input.value = '';
    ask(v);
  });

  document.querySelectorAll('.chip').forEach(c =>
    c.addEventListener('click', () => ask(c.textContent)));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && chatSheet().classList.contains('open')) closeChat();
    trapFocus(e);
  });
  chatSheet().setAttribute('aria-hidden', 'true');

  bubble(t('chat.opening'), 'bot');
}

document.addEventListener('DOMContentLoaded', initChat);
