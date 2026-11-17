/* CHAWAL — talks to the Google Apps Script backend (or a local demo store when none is set) */
window.ChawalAPI = (() => {
  const url = (window.CHAWAL.backend || '').trim();
  const demo = !url;
  const LS = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* noop */ } },
  };
  const uid = () => Math.random().toString(36).slice(2, 10);
  let askPasscode = async () => prompt('chawal group password?');

  /* ---------- demo store ---------- */
  const DEMO = 'chawal-demo-db-v1';
  const db = () => LS.get(DEMO) || { notes: [], plans: [] };
  function demoSend(action, b) {
    const d = db();
    let out = { ok: true };
    if (action === 'addNote') {
      const note = { id: uid(), ts: new Date().toISOString(), name: b.name, text: b.text, color: b.color, doodle: b.doodle };
      d.notes.push(note); out.note = note;
    } else if (action === 'deleteNote') {
      d.notes = d.notes.filter((n) => n.id !== b.id);
    } else if (action === 'addPlan') {
      const plan = { id: uid(), ts: new Date().toISOString(), by: b.by, title: b.title, date: b.date, time: b.time, place: b.place, details: b.details, invited: b.invited, rsvp: {}, hasInvite: false };
      if (b.by) plan.rsvp[b.by] = 'in';
      d.plans.push(plan);
      out = { ok: true, plan, emailed: [], invited: [], demo: true };
    } else if (action === 'rsvp') {
      const p = d.plans.find((x) => x.id === b.id);
      if (p) { p.rsvp[b.name] = b.status; if (!p.invited.includes(b.name)) p.invited.push(b.name); out.plan = p; }
    } else if (action === 'deletePlan') {
      d.plans = d.plans.filter((x) => x.id !== b.id);
    }
    LS.set(DEMO, d);
    return Promise.resolve(out);
  }

  /* ---------- live ---------- */
  async function list() {
    if (demo) { const d = db(); return { ok: true, notes: d.notes.slice().reverse(), plans: d.plans }; }
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'action=list&t=' + Date.now());
    return r.json();
  }
  async function post(body) {
    // a plain-text body keeps this a "simple" request, so Apps Script needs no CORS preflight
    const r = await fetch(url, { method: 'POST', body: JSON.stringify(body) });
    return r.json();
  }
  async function passcode() {
    let pc = LS.get('chawal-pass');
    while (!pc) {
      const tryPc = await askPasscode();
      if (tryPc == null) throw new Error('cancelled');
      const j = await post({ action: 'check', passcode: tryPc });
      if (j.ok) { pc = tryPc; LS.set('chawal-pass', pc); }
    }
    return pc;
  }
  async function send(action, payload) {
    if (demo) return demoSend(action, payload);
    const pc = await passcode();
    const j = await post(Object.assign({ action, passcode: pc }, payload));
    if (!j.ok && j.error === 'wrong passcode') { LS.del('chawal-pass'); return send(action, payload); }
    if (!j.ok) throw new Error(j.error || 'something broke');
    return j;
  }

  return {
    demo,
    list,
    send,
    me: () => LS.get('chawal-me'),
    setMe: (n) => LS.set('chawal-me', n),
    onPasscode: (fn) => { askPasscode = fn; },
  };
})();
