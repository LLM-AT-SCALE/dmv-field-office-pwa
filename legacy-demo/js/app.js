/* ==========================================================================
   Field Office PWA — customer application controller
   ========================================================================== */

const el = sel => document.querySelector(sel);
const root = el('#view');
const liveRegion = el('#live');

let state = {
  view: 'welcome',
  service: null,
  sub: null,
  sectionIndex: 0,
  session: null
};

/* ---------- boot ---------- */

function boot() {
  state.session = currentSession();
  if (state.session) {
    state.service = state.session.service;
    state.sub = state.session.sub_transaction;
    state.view = state.session.submitted_at ? 'submitted'
               : state.session.service === 'DL' ? 'dl'
               : 'token';
  }
  document.documentElement.setAttribute('lang', currentLang());
  render();
  initLanguageToggle();
  setInterval(tick, 1000);
  /* Retention runs while the page is open, so a ticket left on a phone
     overnight disappears rather than lingering. */
  setInterval(enforceRetention, 60000);
}

function enforceRetention() {
  if (!state.session) return;
  if (!isExpired(state.session)) return;
  purgeSession(state.session.session_id);
  state.session = null;
  state.view = 'expired';
  render();
}

/* ---------- live updates ---------- */

function tick() {
  renderOfficeWaits();
  if (!state.session) return;
  const q = queueFor(state.session);

  const railPos = el('#railPosition');
  if (railPos) {
    railPos.textContent = q.called ? t('ticket.goCounter') : q.position + ' ' + t('ticket.ahead');
    el('#railWait').textContent = q.called ? '' : fmtMinutes(q.waitMinutes);
    el('#railServing').textContent = q.nowServing;
    railPos.closest('.rail-card').classList.toggle('is-called', q.called);
  }

  const num = el('#queuePosition');
  if (num) {
    num.textContent = q.called ? t('ticket.now') : q.position;
    el('#queueWait').textContent = q.called ? t('ticket.now').toLowerCase() : fmtMinutes(q.waitMinutes);
    el('#nowServing').textContent = q.nowServing;

    const hero = el('#tokenHero');
    if (hero) {
      hero.classList.toggle('is-near', q.near);
      hero.classList.toggle('is-called', q.called);
    }

    const alert = el('#queueAlert');
    if (alert) {
      if (q.called) {
        alert.className = 'notice';
        alert.innerHTML = `<b>${t('ticket.calledTitle')}</b>${t('ticket.calledBody')}`;
      } else if (q.near) {
        alert.className = 'notice warn';
        alert.innerHTML = `<b>${t('ticket.nearTitle')}</b>${t('ticket.nearBody')}`;
      } else {
        alert.className = 'notice info';
        alert.innerHTML = `<b>${t('ticket.stayTitle')}</b>${t('ticket.stayBody')}`;
      }
    }
  }
}

function go(view) {
  state.view = view;
  render();
  window.scrollTo(0, 0);
}

/* Announcements go to a polite live region so a screen reader hears state
   changes the sighted user sees. */
function announce(msg) { liveRegion.textContent = msg; }

function initLanguageToggle() {
  document.querySelectorAll('.lang').forEach(b => {
    b.addEventListener('click', () => {
      setLang(b.dataset.lang);
      syncChrome();
      render();
      announce(t('a11y.viewChanged', { heading: document.querySelector('#view h1, #view h2')?.textContent || '' }));
    });
  });
  syncChrome();
}

/* Everything outside #view that carries copy — the header, the language
   buttons and the assistant panel — has to follow the language too. */
function syncChrome() {
  const lang = currentLang();
  document.querySelectorAll('.lang').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));

  const set = (sel, val, attr) => {
    const el = document.querySelector(sel);
    if (!el) return;
    if (attr) el.setAttribute(attr, val); else el.textContent = val;
  };
  set('#brandTitle', t('app.title'));
  set('#brandSubtitle', t('app.subtitle'));
  set('#badgeProto', t('app.prototype'));
  set('#skipLink', t('skip.content'));
  set('#chatTitle', t('chat.title'));
  set('#chatClose', t('chat.close'), 'aria-label');
  set('#chatInput', t('chat.placeholder'), 'placeholder');
  set('#chatInputLabel', t('chat.yourQuestion'));
  set('#chatSend', t('chat.send'));
  set('#chatFab', t('form.help'), 'aria-label');
  const sheet = document.querySelector('#chatSheet');
  if (sheet) sheet.setAttribute('aria-label', t('chat.title'));
}

/* ---------- render ---------- */

function render() {
  const views = {
    welcome: viewWelcome,
    service: viewService,
    checklist: viewChecklist,
    token: viewToken,
    form: viewForm,
    review: viewReview,
    submitted: viewSubmitted,
    dl: viewDL,
    expired: viewExpired
  };
  root.innerHTML = (views[state.view] || viewWelcome)();
  document.body.classList.toggle('is-form', state.view === 'form');
  renderRail();
  bind();
  tick();
  focusHeading();
}

/* A single-page app replaces content without a page load, so a screen reader
   is never told anything changed and the keyboard focus is left on a button
   that no longer exists. Moving focus to the new heading fixes both. */
let skipFocus = false;
function focusHeading() {
  if (skipFocus) { skipFocus = false; return; }
  const target = root.querySelector('h1, h2') || root;
  target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

/* The rail is the desktop/kiosk affordance: once a ticket exists it stays in
   view while the customer works through the form. Hidden below 1024px, where
   the token screen itself carries this information. */
function renderRail() {
  const rail = el('#rail');
  if (!rail) return;
  const s = state.session;

  if (!s || state.view === 'token') { rail.innerHTML = ''; return; }

  const q = queueFor(s);
  rail.innerHTML = `
    <div class="rail-card ${q.called ? 'is-called' : ''}">
      <div class="rail-label">${t('ticket.label')}</div>
      <div class="rail-token">${s.token_number}</div>
      <div class="rail-meta">
        ${serviceName(s.service)}<br>
        <span id="railPosition">${q.called ? t('ticket.goCounter') : q.position + ' ' + t('ticket.ahead')}</span><br>
        <span id="railWait">${q.called ? '' : fmtMinutes(q.waitMinutes)}</span>
      </div>
    </div>
    <div class="rail-card">
      <div class="rail-label">${t('ticket.nowServing')}</div>
      <div class="rail-meta" style="margin-top:0;font-size:var(--fs-body);color:var(--c-text)">
        <span id="railServing">${q.nowServing}</span>
      </div>
    </div>
    <button class="btn ghost small block" data-go="token">${t('dl.back')}</button>
  `;
  rail.querySelectorAll('[data-go]').forEach(b =>
    b.addEventListener('click', () => go(b.dataset.go)));
}

/* ---------- S1 welcome ---------- */

function viewWelcome() {
  return `
    ${OFFICE.unresolved ? `
      <div class="notice warn">
        <b>${t('welcome.unknownOffice')}</b>
        ${t('welcome.unknownOfficeBody', { code: escapeHtml(OFFICE.unresolved), office: OFFICE.name })}
      </div>` : ''}
    <div class="eyebrow">${t('welcome.eyebrow')}</div>
    <h1>${OFFICE.name}</h1>
    <p class="lede muted" style="margin-top:var(--s4)">${t('welcome.lede')}</p>

    <div class="stat-strip" id="officeWaits"></div>

    <div class="card flush">
      <dl class="rows">
        <div class="row"><dt>${t('welcome.address')}</dt><dd>${OFFICE.address}</dd></div>
        <div class="row"><dt>${t('welcome.today')}</dt><dd>${OFFICE.hours.today}</dd></div>
        <div class="row"><dt>${t('welcome.status')}</dt><dd style="color:var(--c-ok)">${t('welcome.open')}</dd></div>
      </dl>
    </div>

    <div class="card">
      <h3>${t('welcome.inside')}</h3>
      <ul class="small muted" style="padding-left:var(--s5);margin:var(--s3) 0 0;line-height:1.7">
        ${OFFICE.layout.map(l => `<li>${l}</li>`).join('')}
      </ul>
    </div>

    <button class="btn accent block" data-go="service">${t('welcome.cta')}</button>
  `;
}

function renderOfficeWaits() {
  const w = officeWaits();
  const strip = el('#officeWaits');
  if (!strip) return;
  strip.innerHTML = ['VR', 'DL'].map(code => `
    <div class="stat">
      <b>${fmtMinutes(w[code].minutes)}</b>
      <span>${serviceName(code)} · ${t('welcome.waiting', { n: w[code].depth })}</span>
    </div>`).join('');
}

/* ---------- S2 service selection ---------- */

function viewService() {
  const w = officeWaits();
  const tile = (code) => `
    <button class="tile" data-service="${code}" aria-pressed="${state.service === code}">
      <h3>${serviceName(code)}</h3>
      <div class="small muted">${serviceBlurb(code)}</div>
      <div class="meta">
        <span>${t('service.wait')} <b>${fmtMinutes(w[code].minutes)}</b></span>
        <span><b>${w[code].depth}</b> ${t('service.inQueue')}</span>
      </div>
    </button>`;

  const subs = state.service ? `
    <div class="section-head" style="margin-top:var(--s8)">
      <div class="eyebrow accent">${t('service.step2')}</div>
      <h2>${t('service.heading2')}</h2>
    </div>
    <div class="opts">
      ${SERVICES[state.service].subs.map(sub => `
        <label class="opt">
          <input type="radio" name="sub" value="${sub.id}" ${state.sub === sub.id ? 'checked' : ''}>
          <span>${subLabel(state.service, sub.id)}</span>
        </label>`).join('')}
    </div>
    <button class="btn accent block" style="margin-top:var(--s6)" data-go="checklist" ${state.sub ? '' : 'disabled'}>${t('service.continue')}</button>
  ` : '';

  return `
    <div class="section-head">
      <div class="eyebrow">${t('service.step1')}</div>
      <h2>${t('service.heading')}</h2>
    </div>
    <div class="tiles-grid">
      ${tile('VR')}
      ${tile('DL')}
    </div>
    <button class="btn ghost block small" style="margin-top:var(--s4)" data-chat="${t('service.notSureQ')}">${t('service.notSure')}</button>
    ${subs}
  `;
}

/* ---------- S3 checklist ---------- */

function viewChecklist() {
  const key = `${state.service}:${state.sub}`;
  const items = checklistFor(key);

  return `
    <div class="section-head">
      <div class="eyebrow">${t('checklist.eyebrow')}</div>
      <h2>${subLabel(state.service, state.sub)}</h2>
    </div>
    <p class="small muted">${t('checklist.lede')}</p>

    <ul class="checklist">
      ${items.map((it, i) => `
        <li><label>
          <input type="checkbox" data-check="${i}">
          <span>${it.t}${it.h ? `<span class="hint">${it.h}</span>` : ''}</span>
        </label></li>`).join('')}
    </ul>

    <div class="notice info">
      <b>${t('checklist.feesTitle')}</b>
      ${t('checklist.feesBody')}
    </div>

    <div class="btn-stack">
      <button class="btn accent block" data-action="take-ticket">${t('checklist.cta')}</button>
      <button class="btn ghost block" data-chat="${t('checklist.missingQ')}">${t('checklist.missing')}</button>
    </div>
  `;
}

/* ---------- S4 token ---------- */

function viewToken() {
  const s = state.session;
  const pct = Math.round(completeness(s.form_data) * 100);
  const started = Object.keys(s.form_data).length > 0;

  const applicationCard = s.service === 'VR' ? `
    <div class="card">
      <h3>${t('app.completeTitle')}</h3>
      <p class="small muted" style="margin-top:var(--s2)">
        ${t('app.reg343Intro')}
        ${started ? t('app.progressPct', { pct }) : t('app.timeEstimate')}
      </p>
      <button class="btn accent block" style="margin-top:var(--s4)" data-go="form">
        ${started ? t('app.continue') : t('app.start')}
      </button>
    </div>` : `
    <div class="card">
      <h3>${t('app.completeTitle')}</h3>
      <p class="small muted" style="margin-top:var(--s2)">${t('app.dlIntro')}</p>
      <button class="btn accent block" style="margin-top:var(--s4)" data-go="dl">${t('app.dlContinue')}</button>
    </div>`;

  return `
    <h2 class="sr-only">${t('ticket.label')}: ${s.token_number}</h2>
    <div class="token-hero" id="tokenHero">
      <div class="label">${t('ticket.label')}</div>
      <div class="number">${s.token_number}</div>
      <div class="barcode-wrap">${code39SVG(s.token_number, 56)}</div>
      <div class="sub">${serviceName(s.service)} · ${t('ticket.issued', { time: fmtTime(s.issued_at) })}</div>
      <p class="tiny muted" style="margin:var(--s3) 0 0">
        ${t('ticket.scanHint')}<br>
        ${t('ticket.validUntil', { time: fmtTime(s.expires_at) })}
      </p>
    </div>

    <div class="stat-strip">
      <div class="stat"><b id="queuePosition">–</b><span>${t('ticket.ahead')}</span></div>
      <div class="stat"><b id="queueWait">–</b><span>${t('ticket.estimated')}</span></div>
    </div>

    <div class="card flush">
      <dl class="rows">
        <div class="row"><dt>${t('ticket.nowServing')}</dt><dd id="nowServing">–</dd></div>
        <div class="row"><dt>${t('ticket.yourNumber')}</dt><dd>${s.token_number}</dd></div>
      </dl>
    </div>

    <div class="notice info" id="queueAlert"></div>

    ${applicationCard}

    <button class="btn ghost block small" data-action="give-up">${t('ticket.leave')}</button>
  `;
}

/* ---------- S5-VR form ---------- */

function viewForm() {
  const data = state.session.form_data;
  const sections = visibleSections(data);
  const idx = Math.min(state.sectionIndex, sections.length - 1);
  const section = sections[idx];
  const fields = visibleFields(section, data);
  const pct = Math.round((idx / sections.length) * 100);
  const note = sectionNote(section);

  return `
    <div class="progress">
      <span>${t('form.section', { n: idx + 1, total: sections.length })}</span>
      <div class="progress-track" role="progressbar" aria-valuenow="${idx + 1}" aria-valuemin="1"
           aria-valuemax="${sections.length}" aria-label="${t('form.section', { n: idx + 1, total: sections.length })}">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
      <span class="saved-pill" id="savedPill">${t('form.saved')}</span>
      <button class="progress-help" data-chat="${t('form.helpQ')}" aria-label="${t('form.help')}">?</button>
    </div>

    <div class="section-head">
      <div class="eyebrow">REG 343 · ${t('form.section', { n: section.num, total: 9 }).split(' ')[0]} ${section.num}</div>
      <h2>${sectionTitle(section)}</h2>
      ${note ? `<p class="small muted" style="margin-top:var(--s3)">${note}</p>` : ''}
    </div>

    <form id="sectionForm" novalidate>
      ${fields.map(f => renderField(f, data)).join('')}
    </form>

    ${renderTriggers(data)}

    <div class="form-nav">
      <button class="btn ghost" data-action="prev-section">${idx === 0 ? t('form.back') : t('form.previous')}</button>
      <button class="btn accent" data-action="next-section">${idx === sections.length - 1 ? t('form.review') : t('form.next')}</button>
    </div>
  `;
}

function renderField(f, data) {
  const v = data[f.id] ?? '';
  const req = f.required ? '<span class="req" aria-hidden="true">*</span>' : '';
  const label = fieldLabel(f);
  const hintText = fieldHint(f);
  const hint = hintText ? `<span class="hint" id="${f.id}-hint">${hintText}</span>` : '';
  const describedBy = hintText ? ` aria-describedby="${f.id}-hint"` : '';
  const half = f.half ? ' data-half="1"' : '';

  if (f.type === 'radio') {
    return `
      <fieldset class="field"${half}>
        <legend class="fieldset-label">${label}${req}</legend>
        ${hint}
        <div class="opts ${f.inline ? 'inline' : ''}">
          ${f.options.map(o => `
            <label class="opt">
              <input type="radio" name="${f.id}" value="${escapeAttr(o)}" ${v === o ? 'checked' : ''}${describedBy}>
              <span>${optionLabel(f, o)}</span>
            </label>`).join('')}
        </div>
      </fieldset>`;
  }

  if (f.type === 'checkbox') {
    return `
      <div class="field"${half}>
        <label class="opt">
          <input type="checkbox" name="${f.id}" ${v === true || v === 'true' ? 'checked' : ''}${describedBy}>
          <span>${label}</span>
        </label>
        ${hint}
      </div>`;
  }

  if (f.type === 'select') {
    return `
      <div class="field"${half}>
        <label for="${f.id}">${label}${req}</label>
        ${hint}
        <select id="${f.id}" name="${f.id}"${describedBy}>
          <option value="">${currentLang() === 'es' ? 'Seleccione…' : 'Select…'}</option>
          ${f.options.map(o => `<option value="${escapeAttr(o)}" ${v === o ? 'selected' : ''}>${optionLabel(f, o)}</option>`).join('')}
        </select>
      </div>`;
  }

  if (f.type === 'textarea') {
    return `
      <div class="field"${half}>
        <label for="${f.id}">${label}${req}</label>
        ${hint}
        <textarea id="${f.id}" name="${f.id}"${describedBy}>${escapeHtml(v)}</textarea>
      </div>`;
  }

  const type = f.type === 'currency' ? 'text'
             : f.type === 'number' ? 'number'
             : f.type === 'date' ? 'date'
             : f.type === 'tel' ? 'tel' : 'text';
  const extra = [
    f.max ? `maxlength="${f.max}"` : '',
    f.type === 'currency' ? 'inputmode="decimal" placeholder="0.00"' : '',
    f.type === 'tel' ? 'inputmode="tel" placeholder="(916) 555-0142"' : '',
    f.id === 'vin' ? 'autocapitalize="characters" spellcheck="false"' : ''
  ].filter(Boolean).join(' ');

  return `
    <div class="field"${half}>
      <label for="${f.id}">${label}${req}</label>
      ${hint}
      <input type="${type}" id="${f.id}" name="${f.id}" value="${escapeAttr(v)}" ${extra}${describedBy}>
    </div>`;
}

function renderTriggers(data) {
  const forms = triggeredForms(data);
  const advs = triggeredAdvisories(data);
  if (!forms.length && !advs.length) return '';
  return `
    ${forms.map(f => `
      <div class="notice warn">
        <b>${t('form.alsoNeed', { form: f.form })}</b>
        ${t('form.alsoNeedBody', { title: supplementaryTitle(f.form, f.title) })}
      </div>`).join('')}
    ${advs.map(a => `<div class="notice info"><b>${t('form.pleaseNote')}</b>${advisoryText(a.text)}</div>`).join('')}
  `;
}

/* ---------- review ---------- */

function viewReview() {
  const data = state.session.form_data;
  const missing = missingRequired(data);
  const problems = formatProblems(data);
  const pct = Math.round(completeness(data) * 100);

  const groups = visibleSections(data).map(section => {
    const rows = visibleFields(section, data).map(f => {
      const v = data[f.id];
      const empty = v === undefined || v === null || String(v).trim() === '';
      if (empty && !f.required) return '';
      return `
        <div class="review-item ${empty ? 'missing' : ''}">
          <span>${fieldLabel(f)}</span>
          <b>${empty ? t('review.notAnswered') : escapeHtml(displayValue(f, v))}</b>
        </div>`;
    }).join('');
    if (!rows.trim()) return '';
    return `<div class="review-group"><h3>${section.num}. ${sectionTitle(section)}</h3>${rows}</div>`;
  }).join('');

  return `
    <div class="section-head">
      <div class="eyebrow">${t('review.eyebrow')}</div>
      <h2>${t('review.heading')}</h2>
    </div>

    <div class="stat-strip">
      <div class="stat"><b>${pct}%</b><span>${t('review.complete')}</span></div>
      <div class="stat"><b>${missing.length}</b><span>${t('review.toAnswer')}</span></div>
    </div>

    ${problems.length ? `
      <div class="notice warn">
        <b>${problems.length === 1 ? t('review.problemsTitle1') : t('review.problemsTitle', { n: problems.length })}</b>
        ${problems.map(p => `${fieldLabel({ id: p.id, label: p.label })}: ${p.message}`).join('<br>')}
      </div>` : ''}

    ${missing.length ? `
      <div class="notice warn">
        <b>${missing.length === 1 ? t('review.missingTitle1') : t('review.missingTitle', { n: missing.length })}</b>
        ${t('review.missingBody')}
      </div>` : `
      <div class="notice">
        <b>${t('review.allAnswered')}</b>
        ${t('review.allAnsweredBody')}
      </div>`}

    <div class="notice info">
      <b>${t('review.signTitle')}</b>
      ${t('review.signBody')}
    </div>

    ${groups}

    <div class="btn-stack" style="margin-top:var(--s8)">
      <button class="btn accent block" data-action="submit">${t('review.submit')}</button>
      <button class="btn ghost block" data-go="form">${t('review.keepEditing')}</button>
    </div>
  `;
}

function displayValue(f, v) {
  if (f.type === 'checkbox') return v ? 'Yes' : 'No';
  if (f.type === 'currency') return '$' + money(v);
  return String(v);
}

/* ---------- submitted ---------- */

function viewSubmitted() {
  const s = state.session;
  const missing = missingRequired(s.form_data);
  return `
    <h2 class="sr-only">${t('sent.label')}: ${s.token_number}</h2>
    <div class="token-hero is-called">
      <div class="label">${t('sent.label')}</div>
      <div class="number">${s.token_number}</div>
      <div class="barcode-wrap">${code39SVG(s.token_number, 56)}</div>
      <div class="sub">${t('sent.at', { time: fmtTime(s.submitted_at) })}</div>
    </div>

    <div class="notice">
      <b>${t('sent.title')}</b>
      ${t('sent.body', { token: s.token_number })}
      ${missing.length ? (missing.length === 1 ? t('sent.remaining1') : t('sent.remaining', { n: missing.length })) : ''}
    </div>

    <div class="stat-strip">
      <div class="stat"><b id="queuePosition">–</b><span>${t('ticket.ahead')}</span></div>
      <div class="stat"><b id="queueWait">–</b><span>${t('ticket.estimated')}</span></div>
    </div>

    <div class="card flush">
      <dl class="rows">
        <div class="row"><dt>${t('ticket.nowServing')}</dt><dd id="nowServing">–</dd></div>
      </dl>
    </div>

    <div class="notice info" id="queueAlert"></div>

    <div class="btn-stack">
      <button class="btn ghost block" data-go="review">${t('sent.viewAnswers')}</button>
      <button class="btn ghost block small" data-action="give-up">${t('ticket.leave')}</button>
    </div>
  `;
}

/* ---------- expired ---------- */

function viewExpired() {
  return `
    <div class="section-head">
      <div class="eyebrow">${t('expired.eyebrow')}</div>
      <h2>${t('expired.heading')}</h2>
    </div>

    <div class="notice info">
      <b>${t('expired.title')}</b>
      ${t('expired.body')}
    </div>

    <p class="small muted">${t('expired.next')}</p>

    <button class="btn accent block" data-action="restart">${t('expired.restart')}</button>
  `;
}

/* ---------- S5-DL hand-off ---------- */

function viewDL() {
  const s = state.session;
  const saved = s.edl_confirmation_number;

  return `
    <div class="section-head">
      <div class="eyebrow">${t('dl.eyebrow')}</div>
      <h2>${t('dl.heading')}</h2>
    </div>

    <p class="small muted">${t('dl.body')}</p>

    <div class="notice warn">
      <b>${t('dl.beforeTitle')}</b>
      ${t('dl.beforeBody')}
    </div>

    <a class="btn accent block" href="https://www.edl.dmv.ca.gov/" target="_blank" rel="noopener">${t('dl.open')}</a>
    <p class="tiny muted center" style="margin-top:var(--s3)">${t('dl.newTab')}</p>

    <div class="card" style="margin-top:var(--s8)">
      <h3>${t('dl.confTitle')}</h3>
      <p class="small muted" style="margin:var(--s2) 0 var(--s4)">${t('dl.confBody')}</p>
      <div class="field">
        <label for="edlConf" class="sr-only">${t('dl.confLabel')}</label>
        <input type="text" id="edlConf" value="${escapeAttr(saved || '')}" placeholder="4821-99KD" autocapitalize="characters">
      </div>
      <button class="btn block" data-action="save-edl">${saved ? t('dl.update') : t('dl.save')}</button>
      ${saved ? `<p class="tiny" style="color:var(--c-ok);margin-top:var(--s3)">${t('dl.saved', { token: s.token_number })}</p>` : ''}
    </div>

    <div class="notice info">
      <b>${t('dl.privacyTitle')}</b>
      ${t('dl.privacyBody')}
    </div>

    <button class="btn ghost block" data-go="token">${t('dl.back')}</button>
  `;
}

/* ---------- events ---------- */

function bind() {
  root.querySelectorAll('[data-go]').forEach(b =>
    b.addEventListener('click', () => {
      const t = b.dataset.go;
      if (t === 'form') state.sectionIndex = 0;
      go(t);
    }));

  root.querySelectorAll('[data-service]').forEach(b =>
    b.addEventListener('click', () => { state.service = b.dataset.service; state.sub = null; render(); }));

  root.querySelectorAll('input[name="sub"]').forEach(r =>
    r.addEventListener('change', e => { state.sub = e.target.value; render(); }));

  root.querySelectorAll('[data-chat]').forEach(b =>
    b.addEventListener('click', () => { openChat(); ask(b.dataset.chat); }));

  const form = el('#sectionForm');
  if (form) {
    form.addEventListener('input', onFieldChange);
    form.addEventListener('change', onFieldChange);
    /* Validate when the customer leaves the field, not while they are still
       typing it — telling someone a VIN is too short at the third character
       is noise, not help. */
    form.addEventListener('focusout', onFieldBlur);
  }

  root.querySelectorAll('[data-action]').forEach(b =>
    b.addEventListener('click', () => actions[b.dataset.action]?.()));
}

const actions = {
  'take-ticket': () => {
    state.session = createSession(state.service, state.sub);
    announce(t('a11y.ticketIssued', { token: state.session.token_number }));
    go('token');
  },
  'next-section': () => {
    const data = state.session.form_data;
    const sections = visibleSections(data);
    const section = sections[Math.min(state.sectionIndex, sections.length - 1)];

    /* Flag anything malformed in this section, but never block the customer.
       They may not have the document with them yet. */
    let flagged = 0;
    visibleFields(section, data).forEach(f => {
      const msg = validateField(f, data[f.id], data);
      if (msg) { showFieldError(f.id, msg); flagged++; }
    });
    if (flagged) announce(flagged === 1 ? t('form.needsChecking1') : t('form.needsChecking', { n: flagged }));

    if (state.sectionIndex >= sections.length - 1) { go('review'); }
    else { state.sectionIndex++; render(); }
  },
  'prev-section': () => {
    if (state.sectionIndex === 0) { go('token'); }
    else { state.sectionIndex--; render(); }
  },
  'submit': () => {
    state.session.submitted_at = new Date().toISOString();
    state.session.status = 'submitted';
    saveSession(state.session);
    announce(t('a11y.submitted'));
    go('submitted');
  },
  'save-edl': () => {
    const v = el('#edlConf').value.trim();
    state.session.edl_confirmation_number = v || null;
    state.session.status = v ? 'submitted' : 'waiting';
    state.session.submitted_at = v ? new Date().toISOString() : null;
    saveSession(state.session);
    announce(t('a11y.confSaved'));
    render();
  },
  'restart': () => {
    state = { view: 'welcome', service: null, sub: null, sectionIndex: 0, session: null };
    render();
  },
  'give-up': () => {
    if (!confirm(t('ticket.leaveConfirm'))) return;
    purgeSession(state.session.session_id);
    state = { view: 'welcome', service: null, sub: null, sectionIndex: 0, session: null };
    render();
  }
};

function fieldById(id) {
  for (const section of visibleSections(state.session.form_data)) {
    const f = section.fields.find(x => x.id === id);
    if (f) return f;
  }
  return null;
}

function showFieldError(id, message) {
  const input = root.querySelector(`[name="${id}"]`);
  if (!input) return;
  const wrap = input.closest('.field');
  if (!wrap) return;

  wrap.querySelector('.field-error')?.remove();
  wrap.classList.toggle('invalid', !!message);
  input.setAttribute('aria-invalid', message ? 'true' : 'false');

  if (message) {
    const p = document.createElement('span');
    p.className = 'field-error';
    p.id = `${id}-error`;
    p.textContent = message;
    wrap.appendChild(p);
    input.setAttribute('aria-describedby', p.id);
  } else {
    input.removeAttribute('aria-describedby');
  }
}

function onFieldBlur(e) {
  const t = e.target;
  if (!t.name || !state.session) return;
  const field = fieldById(t.name);
  if (!field) return;
  showFieldError(t.name, validateField(field, t.value, state.session.form_data));
}

let saveTimer;
function onFieldChange(e) {
  const t = e.target;
  if (!t.name) return;
  const value = t.type === 'checkbox' ? t.checked : t.value;
  state.session.form_data[t.name] = value;
  saveSession(state.session);

  /* If the field was flagged, re-check as they type so the error clears the
     moment it is fixed, rather than making them leave the field again. */
  const wrap = t.closest?.('.field');
  if (wrap?.classList.contains('invalid')) {
    const field = fieldById(t.name);
    if (field) showFieldError(t.name, validateField(field, t.value, state.session.form_data));
  }

  const pill = el('#savedPill');
  if (pill) {
    pill.classList.add('on');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => pill.classList.remove('on'), 1200);
  }

  // conditional fields may have appeared or disappeared
  if (t.type === 'radio' || t.tagName === 'SELECT' || t.type === 'checkbox') {
    const active = document.activeElement?.name;
    render();
    if (active) {
      const next = root.querySelector(`[name="${active}"]:checked`) || root.querySelector(`[name="${active}"]`);
      next?.focus?.();
    }
  }
}

/* ---------- helpers ---------- */

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

document.addEventListener('DOMContentLoaded', boot);
