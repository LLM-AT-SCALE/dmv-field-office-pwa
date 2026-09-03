/* ==========================================================================
   Officer view — staff-facing retrieval by token number.
   Reads the same store the customer app writes to.
   Production equivalent: GET /api/v1/staff/token/{token_number}
   ========================================================================== */

const $ = s => document.querySelector(s);
let selected = null;

function boot() {
  /* The counter view belongs to one office, resolved the same way as the
     customer app so a technician cannot be looking at another office's queue. */
  const label = document.querySelector('#officeName');
  if (label) label.textContent = OFFICE.name;
  document.title = `Counter View — ${OFFICE.name}`;

  $('#lookupForm').addEventListener('submit', e => {
    e.preventDefault();
    lookup($('#tokenInput').value);
  });
  $('#resetDemo').addEventListener('click', () => {
    if (confirm('Clear all demo data — queue, tickets and applications?')) { resetDemo(); location.reload(); }
  });
  /* Keep the cursor in the lookup box so a scan lands there without the
     technician having to click first. */
  const input = document.querySelector('#tokenInput');
  input?.focus();
  document.addEventListener('click', e => {
    if (!e.target.closest('button, a, input, select, textarea')) input?.focus();
  });

  renderQueue();
  renderRecord();
  setInterval(renderQueue, 2000);
  window.addEventListener('storage', () => { renderQueue(); renderRecord(); });
}

function lookup(token) {
  const s = findByToken(token);
  if (!s) {
    selected = null;
    $('#record').innerHTML = `
      <div class="o-empty">
        <h2>No application found for “${escapeHtml(token)}”</h2>
        <p class="small">Either the customer has not submitted anything, or the record has already been purged after completion.</p>
      </div>`;
    return;
  }
  selected = s.session_id;
  renderRecord();
  renderQueue();
  document.querySelector('#record').scrollIntoView({ block: 'start' });
}

function renderQueue() {
  const list = allSessions();
  const q = queueState();
  $('#nowServingVR').textContent = 'A-' + String(q.nowServingVR).padStart(3, '0');
  $('#nowServingDL').textContent = 'B-' + String(q.nowServingDL).padStart(3, '0');

  if (!list.length) {
    $('#tokenList').innerHTML = '<li class="small muted" style="padding:var(--s4) 0">No tickets issued yet. Open the customer app and take one.</li>';
    return;
  }

  $('#tokenList').innerHTML = list
    .sort((a, b) => a.seq - b.seq)
    .map(s => {
      const ready = s.status === 'submitted';
      const label = s.service === 'VR'
        ? (ready ? 'REG 343 ready' : 'in progress')
        : (s.edl_confirmation_number ? 'eDL 44 ref' : 'in progress');
      return `
        <li>
          <button data-token="${s.token_number}" aria-current="${selected === s.session_id}">
            <span class="tk">${s.token_number}</span>
            <span class="small muted">${s.service}</span>
            <span class="st ${ready ? 'ready' : ''}">${label}</span>
          </button>
        </li>`;
    }).join('');

  $('#tokenList').querySelectorAll('[data-token]').forEach(b =>
    b.addEventListener('click', () => lookup(b.dataset.token)));
}

function renderRecord() {
  const s = allSessions().find(x => x.session_id === selected);
  const box = $('#record');

  if (!s) {
    box.innerHTML = `
      <div class="o-empty">
        <h2>Call a ticket to begin</h2>
        <p class="small">Enter a token number above, or choose one from the queue on the left.</p>
      </div>`;
    return;
  }

  if (isExpired(s)) {
    box.innerHTML = `
      <div class="o-flag"><b>Ticket ${s.token_number} has expired</b>
      Tickets and their application data are deleted at close of business. This record is being removed now.</div>`;
    purgeSession(s.session_id);
    selected = null;
    renderQueue();
    return;
  }

  const isVR = s.service === 'VR';
  const data = s.form_data || {};
  const missing = isVR ? missingRequired(data) : [];
  const pct = isVR ? Math.round(completeness(data) * 100) : (s.edl_confirmation_number ? 100 : 0);
  const subLabel = SERVICES[s.service].subs.find(x => x.id === s.sub_transaction)?.label || s.sub_transaction;

  const head = `
    <div class="o-recordhead">
      <div>
        <div class="big">${s.token_number}</div>
      </div>
      <div class="meta">
        <b>${SERVICES[s.service].name}</b><br>
        ${subLabel}<br>
        Issued ${fmtTime(s.issued_at)}${s.submitted_at ? ` · submitted ${fmtTime(s.submitted_at)}` : ' · not yet submitted'}<br>
        <span style="color:var(--c-muted)">Deleted on completion, or at ${fmtTime(s.expires_at)} today</span>
        <div class="o-completeness">
          <span>${pct}% complete</span>
          <span class="bar"><i style="width:${pct}%"></i></span>
        </div>
      </div>
      <div class="acts">
        ${isVR ? '<button class="btn small" id="printBtn">Download filled REG 343</button>' : ''}
        <button class="btn ghost small" id="completeBtn">Mark complete &amp; purge</button>
      </div>
    </div>`;

  if (!isVR) {
    box.innerHTML = head + `
      <div class="o-flag ${s.edl_confirmation_number ? 'ok' : ''}">
        <b>${s.edl_confirmation_number ? 'Online application reference supplied' : 'No reference yet'}</b>
        ${s.edl_confirmation_number
          ? `Look up confirmation number <b style="font-family:var(--f-display);font-size:21px">${escapeHtml(s.edl_confirmation_number)}</b> in the DMV system.`
          : 'The customer has not yet completed the online application, or has not entered their confirmation number.'}
      </div>
      <div class="o-flag info">
        <b>No personal data held by this application</b>
        For driver licence transactions this system stores only the confirmation number. Name, date of birth, address and social security number remain in the DMV system of record.
      </div>`;
    bindRecordActions(s);
    return;
  }

  const sections = visibleSections(data).map(section => {
    const cells = visibleFields(section, data).map(f => {
      const v = data[f.id];
      const empty = v === undefined || v === null || String(v).trim() === '';
      if (empty && !f.required) return '';
      const wide = f.type === 'radio' && f.options && f.options.join('').length > 40;
      return `
        <div class="o-cell ${empty ? 'gap' : ''} ${wide ? 'wide' : ''}">
          <dt>${f.label}</dt>
          <dd>${empty ? 'Not answered' : escapeHtml(displayValue(f, v))}</dd>
        </div>`;
    }).filter(Boolean).join('');
    if (!cells) return '';
    return `<div class="o-section"><h3>Section ${section.num} — ${section.title}</h3><dl class="o-grid">${cells}</dl></div>`;
  }).join('');

  const forms = triggeredForms(data);
  const problems = formatProblems(data);

  box.innerHTML = head + `
    ${problems.length ? `<div class="o-flag"><b>${problems.length} ${problems.length === 1 ? 'entry looks' : 'entries look'} incorrect</b>${problems.map(p => `${p.label} &mdash; ${p.message}`).join('<br>')}</div>` : ''}
    ${missing.length
      ? `<div class="o-flag"><b>${missing.length} required field${missing.length === 1 ? '' : 's'} outstanding</b>${missing.map(m => m.label).join(' · ')}</div>`
      : `<div class="o-flag ok"><b>All required fields answered</b>Download the filled form, obtain signature, and proceed.</div>`}

    ${forms.length ? `<div class="o-flag"><b>Supplementary forms required</b>${forms.map(f => `${f.form} — ${f.title}`).join('<br>')}</div>` : ''}

    <div class="o-flag info">
      <b>Signature required at the counter</b>
      Section 9 must be signed in person under penalty of perjury (CVC §1808.21). Download the filled form and obtain signature before processing.
    </div>

    ${sections || '<div class="o-empty"><h2>Nothing entered yet</h2><p class="small">The customer has a ticket but has not started the form.</p></div>'}
  `;
  bindRecordActions(s);
}

function bindRecordActions(s) {
  $('#printBtn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Preparing…';
    try {
      const name = await downloadREG343(s.form_data, { token: s.token_number });
      btn.textContent = 'Downloaded';
      setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2200);
      console.log('[reg343] wrote', name);
    } catch (err) {
      console.error(err);
      btn.textContent = 'Failed — see console';
      alertBanner(err.message || 'Could not generate the PDF.');
      setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 3000);
    }
  });
  $('#completeBtn')?.addEventListener('click', () => {
    if (!confirm(`Mark ${s.token_number} complete? The application record is permanently deleted.`)) return;
    purgeSession(s.session_id);
    selected = null;
    renderQueue();
    renderRecord();
  });
}

function money(v) {
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  if (!isFinite(n)) return String(v);
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function alertBanner(msg) {
  const box = document.querySelector('#record');
  const el = document.createElement('div');
  el.className = 'o-flag';
  el.innerHTML = '<b>Could not generate the PDF</b>' + escapeHtml(msg);
  box.prepend(el);
  setTimeout(() => el.remove(), 6000);
}

function displayValue(f, v) {
  if (f.type === 'checkbox') return v ? 'Yes' : 'No';
  if (f.type === 'currency') return '$' + money(v);
  return String(v);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

document.addEventListener('DOMContentLoaded', boot);
