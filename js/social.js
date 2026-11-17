/* CHAWAL — the shared bits: plans calendar + guestbook */
(() => {
  const D = window.CHAWAL;
  const API = window.ChawalAPI;
  const FX = window.ChawalFX || { burst() {}, rain() {} };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const todayISO = () => iso(new Date());
  const hash = (s) => [...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0);
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const MEMBERS = [{ name: D.heart.name, face: 'assets/people/muhsin-face.webp' }, ...D.members.map((m) => ({ name: m.name, face: m.face }))];
  const faceOf = (n) => (MEMBERS.find((m) => m.name === n) || {}).face || '';
  const fmtTime = (t) => { if (!t) return ''; let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return m ? `${h}:${pad(m)} ${ap}` : `${h} ${ap}`; };
  const prettyDate = (p) => {
    const s = parseISO(p.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toLowerCase();
    return p.time ? `${s}, ${fmtTime(p.time)}` : s;
  };
  const daysUntil = (ds) => Math.round((parseISO(ds) - parseISO(todayISO())) / 864e5);
  const countdown = (ds) => { const n = daysUntil(ds); return n === 0 ? 'today!!' : n === 1 ? 'tomorrow' : `in ${n} days`; };
  const RS_LABEL = { in: "in", maybe: 'maybe', out: "can't", none: 'no reply' };

  /* ───────────── toast ───────────── */
  const toastEl = document.createElement('div');
  toastEl.className = 'toast';
  toastEl.setAttribute('role', 'status');
  document.body.appendChild(toastEl);
  let toastT;
  function toast(msg, ms = 2600) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    if (ms) toastT = setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  /* ───────────── modal ───────────── */
  const modal = $('#modal');
  const card = $('#modalCard');
  let pending = null; // resolver for prompt-style modals
  function openModal(html, cls = '') {
    if (pending) { const r = pending; pending = null; r(null); }
    card.className = 'modal-card ' + cls;
    card.innerHTML = html + '<button type="button" class="modal-x" data-close aria-label="close">×</button>';
    modal.hidden = false;
    document.body.classList.add('locked');
    setTimeout(() => { const f = card.querySelector('input:not([type=checkbox]):not([type=hidden]), textarea'); if (f && matchMedia('(pointer:fine)').matches) f.focus(); }, 60);
    return card;
  }
  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('locked');
    card.innerHTML = '';
    if (pending) { const r = pending; pending = null; r(null); }
  }
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-close]')) closeModal(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
  const resolveWith = (v) => { const r = pending; pending = null; closeModal(); if (r) r(v); };

  function pickMe({ allowGuest = false } = {}) {
    return new Promise((res) => {
      openModal(`
        <h3 class="m-title">who's holding the phone?</h3>
        <div class="who-grid">${MEMBERS.map((m) => `<button type="button" class="who" data-n="${esc(m.name)}"><img src="${m.face}" alt=""><span>${esc(m.name)}</span></button>`).join('')}</div>
        ${allowGuest ? '<form class="guest-form"><input name="g" maxlength="24" placeholder="not chawal? type your name"><button>that\'s me</button></form>' : ''}`, 'm-who');
      pending = res;
      $$('.who', card).forEach((b) => { b.onclick = () => { API.setMe(b.dataset.n); resolveWith(b.dataset.n); }; });
      const gf = $('.guest-form', card);
      if (gf) gf.onsubmit = (e) => { e.preventDefault(); const n = gf.g.value.trim(); if (n) resolveWith(`${n} (guest)`); };
    });
  }

  API.onPasscode(() => new Promise((res) => {
    openModal(`
      <h3 class="m-title">group password</h3>
      <p class="hand m-lead">only chawal can post. ask muhsin if you forgot it.</p>
      <form class="pass-form"><input type="password" name="p" required autocomplete="current-password"><button>unlock</button></form>`, 'm-pass');
    pending = res;
    const f = $('form', card);
    f.onsubmit = (e) => { e.preventDefault(); resolveWith(f.p.value); };
  }));

  /* ───────────── data ───────────── */
  const state = { notes: [], plans: [] };
  function setConn(ok, err) {
    $$('[data-conn]').forEach((el) => {
      el.className = 'conn ' + (API.demo ? 'is-demo' : ok ? 'is-live' : 'is-off');
      el.innerHTML = API.demo
        ? '<b>demo mode</b> saved on this device only, until the shared backend is connected (backend/SETUP.md)'
        : ok ? '<b>live</b> shared with all of chawal' : `<b>offline</b> couldn't reach the backend: ${esc(err)}`;
    });
  }
  async function refresh() {
    try {
      const j = await API.list();
      if (!j.ok) throw new Error(j.error || 'bad response');
      state.notes = j.notes || [];
      state.plans = j.plans || [];
      setConn(true);
    } catch (e) { setConn(false, e.message); }
    renderCal(); renderUpNext(); renderWall();
  }
  setInterval(() => { if (!document.hidden && modal.hidden) refresh(); }, 45000);

  /* ───────────── calendar ───────────── */
  const view = new Date(); view.setDate(1);
  function renderCal() {
    const y = view.getFullYear(), m = view.getMonth();
    $('#calMonth').innerHTML = `${MONTHS[m]} <small>${y}</small>`;
    const offset = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const today = todayISO();
    let html = '';
    for (let i = 0; i < offset; i++) html += '<div class="day blank"></div>';
    for (let d = 1; d <= days; d++) {
      const ds = iso(new Date(y, m, d));
      const plans = state.plans.filter((p) => p.date === ds).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      const past = ds < today;
      html += `<div class="day${ds === today ? ' today' : ''}${past ? ' past' : ''}${plans.length ? ' has' : ''}" data-date="${ds}" ${past ? '' : 'role="button" tabindex="0"'} aria-label="${d} ${MONTHS[m]}${plans.length ? `, ${plans.length} plan${plans.length > 1 ? 's' : ''}` : ''}">
        <span class="num">${d}</span>
        ${plans.slice(0, 2).map((p) => `<button type="button" class="chip c${hash(p.id) % 5}" data-plan="${esc(p.id)}">${p.time ? `<i>${fmtTime(p.time)}</i>` : ''}${esc(p.title)}</button>`).join('')}
        ${plans.length > 2 ? `<button type="button" class="more" data-more="${ds}">+${plans.length - 2} more</button>` : ''}
      </div>`;
    }
    const cells = offset + days;
    for (let i = cells; i < Math.ceil(cells / 7) * 7; i++) html += '<div class="day blank"></div>';
    $('#calGrid').innerHTML = html;
  }
  $('#calPrev').onclick = () => { view.setMonth(view.getMonth() - 1); renderCal(); };
  $('#calNext').onclick = () => { view.setMonth(view.getMonth() + 1); renderCal(); };
  function onGrid(e) {
    const chip = e.target.closest('[data-plan]');
    if (chip) return openPlan(chip.dataset.plan);
    const more = e.target.closest('[data-more]');
    if (more) return openDay(more.dataset.more);
    const day = e.target.closest('.day');
    if (!day || day.classList.contains('blank') || day.classList.contains('past')) return;
    openPlanForm({ date: day.dataset.date });
  }
  $('#calGrid').addEventListener('click', onGrid);
  $('#calGrid').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('day')) { e.preventDefault(); onGrid(e); } });

  function faces(p) {
    return p.invited.map((n) => { const s = p.rsvp[n] || 'none'; return `<img src="${faceOf(n)}" class="st-${s}" alt="${esc(n)}" title="${esc(n)}: ${RS_LABEL[s]}">`; }).join('');
  }
  function renderUpNext() {
    const t = todayISO();
    const up = state.plans.filter((p) => p.date >= t).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).slice(0, 4);
    $('#upNext').innerHTML = up.length ? up.map((p) => {
      const d = parseISO(p.date);
      return `<button type="button" class="stub c${hash(p.id) % 5}" data-plan="${esc(p.id)}">
        <span class="stub-date"><b>${d.getDate()}</b><small>${MONTHS[d.getMonth()].slice(0, 3)}</small></span>
        <span class="stub-body">
          <span class="count">${countdown(p.date)}</span>
          <b>${esc(p.title)}</b>
          <small>${[fmtTime(p.time), p.place].filter(Boolean).map(esc).join(' · ') || '&nbsp;'}</small>
          <span class="faces">${faces(p)}</span>
        </span>
      </button>`;
    }).join('') : '<p class="empty hand">nothing planned. that\'s illegal. tap a day on the calendar.</p>';
  }
  $('#upNext').addEventListener('click', (e) => { const s = e.target.closest('[data-plan]'); if (s) openPlan(s.dataset.plan); });

  /* quick plan: "20 nov karaoke night 8pm at the usual" */
  function parseQuick(raw) {
    let t = ` ${raw.toLowerCase().replace(/\s+/g, ' ')} `;
    const out = {};
    const now = new Date(); now.setHours(0, 0, 0, 0);
    let m;
    // time first so "8.30pm" isn't read as a date
    if ((m = t.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/))) {
      let h = +m[1] % 12; if (m[3] === 'pm') h += 12;
      out.time = `${pad(h)}:${m[2] || '00'}`; t = t.replace(m[0], ' ');
    } else if ((m = t.match(/\b(\d{1,2}):(\d{2})\b/))) {
      out.time = `${pad(+m[1])}:${m[2]}`; t = t.replace(m[0], ' ');
    } else if ((m = t.match(/\bnoon\b/))) { out.time = '12:00'; t = t.replace(m[0], ' '); }
    const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const monRe = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*';
    let date = null;
    if ((m = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?${monRe}\\b`)))) { date = new Date(now.getFullYear(), MON[m[2]], +m[1]); t = t.replace(m[0], ' '); }
    else if ((m = t.match(new RegExp(`\\b${monRe}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`)))) { date = new Date(now.getFullYear(), MON[m[1]], +m[2]); t = t.replace(m[0], ' '); }
    else if ((m = t.match(/\b(\d{1,2})[/-](\d{1,2})\b/))) { date = new Date(now.getFullYear(), +m[2] - 1, +m[1]); t = t.replace(m[0], ' '); }
    else if ((m = t.match(/\b(today|tonight)\b/))) { date = new Date(now); t = t.replace(m[0], ' '); }
    else if ((m = t.match(/\b(tomorrow|tmrw|tmr)\b/))) { date = new Date(now); date.setDate(date.getDate() + 1); t = t.replace(m[0], ' '); }
    else if ((m = t.match(/\b(next |this )?(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/))) {
      let diff = (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(m[2]) - now.getDay() + 7) % 7;
      if (m[1] === 'next ' && diff === 0) diff = 7;
      date = new Date(now); date.setDate(date.getDate() + diff); t = t.replace(m[0], ' ');
    }
    if (date && date < now) date.setFullYear(date.getFullYear() + 1);
    if (date) out.date = iso(date);
    if ((m = t.match(/\s(?:at|@)\s+(.+?)\s*$/))) { out.place = m[1].trim(); t = t.replace(m[0], ' '); }
    out.title = t.replace(/\s+/g, ' ').replace(/^\s*(on|,|-)\s+/, '').replace(/\s+(on|,|-)\s*$/, '').trim() || 'chawal hangout';
    return out;
  }
  $('#quickForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#quickInput').value.trim();
    if (!v) return $('#quickInput').focus();
    openPlanForm(parseQuick(v));
  });

  /* plan form */
  const waText = (p) => [
    '🍚 *CHAWAL PLAN*',
    `*${p.title}*`,
    `📅 ${prettyDate(p)}`,
    p.place ? `📍 ${p.place}` : '',
    p.details || '',
    '',
    D.siteUrl ? `who's in? rsvp here: ${D.siteUrl}#plans` : "who's in? reply here 👇",
    p.by ? `— ${p.by}` : '',
  ].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n');
  const waLink = (p) => 'https://wa.me/?text=' + encodeURIComponent(waText(p));

  function openPlanForm(v = {}, err = '') {
    const me = API.me();
    const invited = v.invited || MEMBERS.map((m) => m.name);
    const ch = v.channels || { email: true, calendar: false, whatsapp: true };
    openModal(`
      <h3 class="m-title">pin a plan</h3>
      ${err ? `<p class="m-err">${esc(err)}</p>` : ''}
      <form class="plan-form">
        <label>what's the plan<input name="title" maxlength="80" required value="${esc(v.title || '')}" placeholder="karaoke night"></label>
        <div class="row">
          <label>date<input type="date" name="date" required value="${esc(v.date || todayISO())}" min="${todayISO()}"></label>
          <label>time<input type="time" name="time" value="${esc(v.time || '')}"></label>
        </div>
        <label>where<input name="place" maxlength="80" value="${esc(v.place || '')}" placeholder="dough &amp; joe, obviously"></label>
        <label>details<textarea name="details" maxlength="400" rows="2" placeholder="bring your worst song">${esc(v.details || '')}</textarea></label>
        <fieldset><legend>who's invited</legend>
          <div class="inv">${MEMBERS.map((m) => `<label class="inv-chip"><input type="checkbox" name="inv" value="${esc(m.name)}" ${invited.includes(m.name) ? 'checked' : ''}><img src="${m.face}" alt=""><span>${esc(m.name)}</span></label>`).join('')}</div>
        </fieldset>
        <fieldset><legend>tell them by</legend>
          <div class="chan">
            <label><input type="checkbox" name="email" ${ch.email ? 'checked' : ''}> email <small>sent automatically + reminder the day before</small></label>
            <label><input type="checkbox" name="calendar" ${ch.calendar ? 'checked' : ''}> google calendar invite <small>lands in their calendar</small></label>
            <label><input type="checkbox" name="whatsapp" ${ch.whatsapp ? 'checked' : ''}> whatsapp message <small>one tap to send to the group</small></label>
          </div>
          ${API.demo ? '<p class="m-note">demo mode: emails + calendar invites switch on once the backend is connected.</p>' : ''}
        </fieldset>
        <div class="row by"><span class="typed">posted by</span><select name="by">${MEMBERS.map((m) => `<option ${m.name === (v.by || me) ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></div>
        <button class="tear-btn" type="submit">pin it to the calendar</button>
      </form>`, 'm-plan');
    const f = $('form', card);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const el = f.elements; // (f.title would be the form's own title attribute)
      const vals = {
        title: el.title.value.trim(), date: el.date.value, time: el.time.value, place: el.place.value.trim(), details: el.details.value.trim(),
        invited: $$('input[name=inv]:checked', f).map((x) => x.value), by: el.by.value,
        channels: { email: el.email.checked, calendar: el.calendar.checked, whatsapp: el.whatsapp.checked },
      };
      if (!vals.invited.length) vals.invited = MEMBERS.map((m) => m.name);
      if (!API.me()) API.setMe(vals.by);
      closeModal();
      toast('pinning it…', 0);
      try {
        const j = await API.send('addPlan', vals);
        toast('pinned!');
        await refresh();
        const d = parseISO(vals.date);
        if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()) { view.setFullYear(d.getFullYear(), d.getMonth(), 1); renderCal(); }
        FX.burst(innerWidth / 2, innerHeight / 2, 90, { power: 12, hearts: .15 });
        planDone(j.plan || vals, j, vals.channels);
      } catch (er) {
        toast('');
        toastEl.classList.remove('show');
        openPlanForm(vals, er.message === 'cancelled' ? '' : er.message);
      }
    };
  }

  function planDone(p, res, ch) {
    const lines = [];
    if (ch.email) lines.push(API.demo ? 'email: off in demo mode' : res.emailed && res.emailed.length ? `emailed ${res.emailed.length} ${res.emailed.length === 1 ? 'person' : 'people'} ✓` : 'no emails sent (add everyone\'s email in the backend config)');
    if (ch.calendar) lines.push(API.demo ? 'calendar invites: off in demo mode' : res.invited && res.invited.length ? `calendar invites sent to ${res.invited.length} ✓` : 'no calendar invites sent (no emails set)');
    openModal(`
      <div class="done-burst" aria-hidden="true">✓</div>
      <h3 class="m-title">pinned!</h3>
      <p class="hand m-lead">${esc(p.title)} · ${esc(prettyDate(p))}</p>
      ${lines.length ? `<ul class="done-list typed">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
      ${ch.whatsapp ? `<a class="wa-btn" href="${waLink(p)}" target="_blank" rel="noopener">send it to the chawal whatsapp</a>
        <button type="button" class="link-btn" id="copyMsg">or copy the message</button>` : ''}
      <button type="button" class="link-btn" data-close>done</button>`, 'm-done');
    const c = $('#copyMsg', card);
    if (c) c.onclick = async () => { try { await navigator.clipboard.writeText(waText(p)); c.textContent = 'copied ✓'; } catch { c.textContent = 'couldn\'t copy, use the button'; } };
  }

  function openPlan(id) {
    const p = state.plans.find((x) => String(x.id) === String(id));
    if (!p) return;
    const me = API.me();
    const mine = me && p.rsvp[me];
    openModal(`
      <div class="pd-date typed">${esc(prettyDate(p))} · ${countdown(p.date)}</div>
      <h3 class="m-title">${esc(p.title)}</h3>
      ${p.place ? `<p class="pd-place hand">📍 ${esc(p.place)}</p>` : ''}
      ${p.details ? `<p class="pd-details">${esc(p.details)}</p>` : ''}
      <p class="typed pd-by">planned by ${esc(p.by || '?')}${p.hasInvite ? ' · calendar invites sent' : ''}</p>
      <div class="pd-who">${p.invited.map((n) => { const s = p.rsvp[n] || 'none'; return `<div class="pd-person st-${s}"><img src="${faceOf(n)}" alt=""><span>${esc(n)}</span><em>${RS_LABEL[s]}</em></div>`; }).join('')}</div>
      <div class="pd-rsvp"><span class="typed">${me ? `${esc(me)}, you in?` : 'you in?'}</span>
        <button type="button" data-rs="in" class="${mine === 'in' ? 'on' : ''}">i'm in</button>
        <button type="button" data-rs="maybe" class="${mine === 'maybe' ? 'on' : ''}">maybe</button>
        <button type="button" data-rs="out" class="${mine === 'out' ? 'on' : ''}">can't</button>
      </div>
      <div class="pd-actions">
        <a class="wa-btn small" href="${waLink(p)}" target="_blank" rel="noopener">share on whatsapp</a>
        <button type="button" class="link-btn pd-del">cancel plan</button>
      </div>`, 'm-detail');
    $$('[data-rs]', card).forEach((b) => b.onclick = async () => {
      const status = b.dataset.rs;
      const who = API.me() || await pickMe();
      if (!who) return openPlan(id);
      closeModal();
      try {
        await API.send('rsvp', { id: p.id, name: who, status });
        await refresh();
        if (status === 'in') FX.burst(innerWidth / 2, innerHeight / 2, 50, { power: 10, hearts: .3 });
        openPlan(id);
      } catch (er) { if (er.message !== 'cancelled') toast(er.message); openPlan(id); }
    });
    $('.pd-del', card).onclick = () => {
      $('.pd-actions', card).innerHTML = `
        <div class="pd-confirm"><p class="hand">cancel <b>${esc(p.title)}</b>?</p>
        ${API.demo ? '' : '<label class="typed"><input type="checkbox" id="pdNotify" checked> email everyone that it\'s off</label>'}
        <button type="button" class="danger" id="pdYes">yes, cancel it</button><button type="button" class="link-btn" id="pdNo">no, keep it</button></div>`;
      $('#pdNo', card).onclick = () => openPlan(id);
      $('#pdYes', card).onclick = async () => {
        const notify = !!($('#pdNotify', card) || {}).checked;
        closeModal();
        try { await API.send('deletePlan', { id: p.id, notify, name: API.me() || '' }); toast('plan cancelled'); await refresh(); } catch (er) { if (er.message !== 'cancelled') toast(er.message); }
      };
    };
  }

  function openDay(ds) {
    const plans = state.plans.filter((p) => p.date === ds);
    openModal(`<h3 class="m-title">${esc(parseISO(ds).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).toLowerCase())}</h3>
      <div class="day-list">${plans.map((p) => `<button type="button" class="chip c${hash(p.id) % 5}" data-plan="${esc(p.id)}">${p.time ? `<i>${fmtTime(p.time)}</i>` : ''}${esc(p.title)}</button>`).join('')}</div>
      <button type="button" class="link-btn" id="dayAdd">+ add another plan this day</button>`, 'm-day');
    $$('[data-plan]', card).forEach((b) => b.onclick = () => openPlan(b.dataset.plan));
    $('#dayAdd', card).onclick = () => openPlanForm({ date: ds });
  }

  /* ───────────── guestbook ───────────── */
  const canvas = $('#gbCanvas');
  const g = canvas.getContext('2d');
  const PENS = ['#2b2320', '#e2483d', '#4f7cc2', '#2e7d4f', '#f2b632', '#f08ab0'];
  const SIZES = [['thin', 4], ['medium', 9], ['thick', 16]];
  const PAPERS = ['yellow', 'pink', 'green', 'blue', 'white'];
  let pen = PENS[0], sizeI = 0, paper = 'yellow', strokes = [], cur = null;
  let gbName = API.me();

  $('#gbPens').innerHTML = PENS.map((c, i) => `<button type="button" class="pen${i ? '' : ' on'}" data-c="${c}" style="--pc:${c}" aria-label="pen colour ${i + 1}"></button>`).join('');
  $('#gbPens').onclick = (e) => { const b = e.target.closest('.pen'); if (!b) return; pen = b.dataset.c; $$('.pen').forEach((x) => x.classList.toggle('on', x === b)); };
  $('#gbSize').onclick = () => { sizeI = (sizeI + 1) % SIZES.length; $('#gbSize').textContent = SIZES[sizeI][0]; };
  $('#gbUndo').onclick = () => { strokes.pop(); redraw(); };
  $('#gbClear').onclick = () => { strokes = []; redraw(); };
  $('#gbPapers').innerHTML = PAPERS.map((p, i) => `<button type="button" class="paper paper-${p}${i ? '' : ' on'}" data-p="${p}" aria-label="${p} paper"></button>`).join('');
  $('#gbPapers').onclick = (e) => { const b = e.target.closest('.paper'); if (!b) return; paper = b.dataset.p; $$('.paper').forEach((x) => x.classList.toggle('on', x === b)); $('#gbForm').dataset.paper = paper; };
  $('#gbForm').dataset.paper = paper;

  function drawStroke(ctx, s, k = 1) {
    ctx.strokeStyle = s.c; ctx.lineWidth = s.w * k; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const pts = s.pts;
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * k, pts[0][1] * k);
    if (pts.length === 1) ctx.lineTo(pts[0][0] * k + .1, pts[0][1] * k);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0] * k, pts[i][1] * k, mx * k, my * k);
    }
    if (pts.length > 1) ctx.lineTo(pts[pts.length - 1][0] * k, pts[pts.length - 1][1] * k);
    ctx.stroke();
  }
  function redraw() {
    g.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach((s) => drawStroke(g, s));
    $('#gbHint').hidden = strokes.length > 0;
  }
  const at = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height]; };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    cur = { c: pen, w: SIZES[sizeI][1], pts: [at(e)] };
    strokes.push(cur); redraw();
  });
  canvas.addEventListener('pointermove', (e) => { if (!cur) return; cur.pts.push(at(e)); redraw(); });
  const endStroke = () => { cur = null; };
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);

  function exportDoodle() {
    if (!strokes.length) return '';
    let k = .75, url = '';
    do {
      const c = document.createElement('canvas');
      c.width = Math.round(canvas.width * k); c.height = Math.round(canvas.height * k);
      const x = c.getContext('2d');
      strokes.forEach((s) => drawStroke(x, s, k));
      url = c.toDataURL('image/png');
      k -= .15;
    } while (url.length > 45000 && k > .25);
    return url.length > 48000 ? '' : url;
  }

  const setWho = () => { $('#gbWho').textContent = gbName || 'pick your name'; $('#gbWho').classList.toggle('set', !!gbName); };
  setWho();
  $('#gbWho').onclick = async () => { const n = await pickMe({ allowGuest: true }); if (n) { gbName = n; setWho(); } };

  $('#gbForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = $('#gbStatus');
    const text = $('#gbText').value.trim();
    const doodle = exportDoodle();
    if (!text && !strokes.length) { status.textContent = 'write or doodle something first!'; return; }
    if (strokes.length && !doodle) { status.textContent = 'that doodle is too big, try fewer scribbles'; return; }
    if (!gbName) gbName = API.me();
    if (!gbName) { gbName = await pickMe({ allowGuest: true }); if (!gbName) return; }
    setWho();
    status.textContent = 'sticking it in…';
    try {
      await API.send('addNote', { name: gbName, text, doodle, color: paper });
      $('#gbText').value = ''; strokes = []; redraw();
      status.textContent = 'stuck! ♥';
      await refresh();
      const r = $('#gbWall').getBoundingClientRect();
      FX.burst(r.left + Math.min(r.width, 200), Math.max(40, r.top + 40), 60, { power: 10, hearts: .4 });
    } catch (er) { status.textContent = er.message === 'cancelled' ? '' : er.message; }
  });

  function renderWall() {
    const me = API.me();
    $('#gbWall').innerHTML = state.notes.length ? state.notes.map((n) => {
      const h = hash(n.id);
      const doodle = /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(n.doodle || '') ? n.doodle : '';
      const when = n.ts ? new Date(n.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toLowerCase() : '';
      const paperC = PAPERS.includes(n.color) ? n.color : 'yellow';
      return `<article class="gb-note paper-${paperC}" style="--r:${(h % 9) - 4}deg">
        <span class="tape tape--${['yellow', 'pink', 'green', 'blue', 'stripe'][h % 5]}"></span>
        ${doodle ? `<img src="${doodle}" alt="doodle by ${esc(n.name)}">` : ''}
        ${n.text ? `<p>${esc(n.text)}</p>` : ''}
        <footer>— ${esc(n.name)} <time>${esc(when)}</time></footer>
        ${API.demo || (me && n.name === me) ? `<button type="button" class="gb-del" data-del="${esc(n.id)}" aria-label="peel off this note">×</button>` : ''}
      </article>`;
    }).join('') : '<p class="empty hand">the guestbook is empty. be the first. no pressure (pressure).</p>';
  }
  $('#gbWall').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del]');
    if (!b || !confirm('peel this note off the guestbook?')) return;
    try { await API.send('deleteNote', { id: b.dataset.del }); await refresh(); } catch (er) { if (er.message !== 'cancelled') toast(er.message); }
  });

  refresh();
})();
