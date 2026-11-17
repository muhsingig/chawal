/**
 * CHAWAL scrapbook — shared backend (Google Apps Script web app)
 * ─────────────────────────────────────────────────────────────
 * Stores the guestbook + plans calendar in this Google Sheet and does the automation:
 *   • emails the people picked when someone pins a plan
 *   • (optional) sends Google Calendar invites to them
 *   • emails a reminder the day before and the morning of each plan
 *   • tells the plan's creator when someone RSVPs
 *
 * Setup steps are in backend/SETUP.md.
 * Everyone's emails live in the sheet's "members" tab, and the group passcode + site link
 * live in the "settings" tab, so nobody has to touch this code after pasting it in.
 */

const CONFIG = {
  TIMEZONE: 'Asia/Kolkata',
  SHEET_ID: '1uaJjwuB3qTP-wU6aduUKF28T5yle50UKZZHuFfmO_tU', // the "chawal backend" sheet
  NAMES: ['Muhsin', 'Pavitra', 'Hatim', 'Hamza', 'Tanya'],

  RSVP_EMAILS: true,       // email the plan's creator when someone says in / maybe / out
  REMINDER_HOUR: 9,        // daily reminder check runs around this hour (24h)
  PLAN_LENGTH_HOURS: 3,    // calendar invite length
};

/* ═══════════════ one-time setup (run this once from the editor) ═══════════════ */
function setup() {
  const ss = CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Set CONFIG.SHEET_ID to the Google Sheet's id.');
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  sheet_('notes', NOTE_COLS);
  sheet_('plans', PLAN_COLS);
  const mem = sheet_('members', ['name', 'email']);
  if (mem.getLastRow() < 2) mem.getRange(2, 1, CONFIG.NAMES.length, 2).setValues(CONFIG.NAMES.map((n) => [n, '']));
  const set = sheet_('settings', ['key', 'value']);
  if (set.getLastRow() < 2) {
    const words = ['basmati', 'biryani', 'pulao', 'khichdi', 'jeera', 'kheer', 'papad', 'achaar', 'ghee', 'tadka', 'masala', 'chutney'];
    const pick = () => words[Math.floor(Math.random() * words.length)];
    const code = pick() + '-' + pick() + '-' + (10 + Math.floor(Math.random() * 90));
    set.getRange(2, 1, 2, 2).setValues([['passcode', code], ['site_url', '']]);
  }
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'dailyReminders')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('dailyReminders').timeBased().everyDays(1).atHour(CONFIG.REMINDER_HOUR).inTimezone(CONFIG.TIMEZONE).create();
  // touch the services once so Google asks for every permission now, not later
  MailApp.getRemainingDailyQuota();
  CalendarApp.getDefaultCalendar();
  Logger.log('chawal backend ready. group passcode: ' + passcode_() + ' · emails left today: ' + MailApp.getRemainingDailyQuota());
}

/* ═══════════════ web app entry points ═══════════════ */
function doGet(e) {
  cache_ = null;
  const action = (e && e.parameter && e.parameter.action) || 'list';
  if (action === 'ping') return json_({ ok: true, members: CONFIG.NAMES });
  if (action === 'list') return json_({ ok: true, notes: readAll_('notes', NOTE_COLS).reverse(), plans: readAll_('plans', PLAN_COLS).map(publicPlan_) });
  return json_({ ok: false, error: 'unknown action' });
}

function doPost(e) {
  cache_ = null;
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad request' }); }
  const good = String(body.passcode || '').trim().toLowerCase() === passcode_().toLowerCase();
  if (body.action === 'check') return json_({ ok: good, error: good ? '' : 'wrong passcode' });
  if (!good) return json_({ ok: false, error: 'wrong passcode' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    switch (body.action) {
      case 'addNote': return json_(addNote_(body));
      case 'deleteNote': return json_(deleteRow_('notes', NOTE_COLS, body.id));
      case 'addPlan': return json_(addPlan_(body));
      case 'rsvp': return json_(rsvp_(body));
      case 'deletePlan': return json_(deletePlan_(body));
      default: return json_({ ok: false, error: 'unknown action' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

/* ═══════════════ guestbook ═══════════════ */
const NOTE_COLS = ['id', 'ts', 'name', 'text', 'color', 'doodle'];

function addNote_(b) {
  const name = clean_(b.name, 30);
  const text = clean_(b.text, 400);
  const doodle = String(b.doodle || '');
  if (!name) throw new Error('who are you?');
  if (!text && !doodle) throw new Error('write or draw something first');
  if (doodle && (!/^data:image\/(png|webp|jpeg);base64,/.test(doodle) || doodle.length > 49000)) throw new Error('doodle too big — try fewer scribbles');
  const note = { id: id_(), ts: new Date().toISOString(), name, text, color: clean_(b.color, 12) || 'yellow', doodle };
  append_('notes', NOTE_COLS, note);
  return { ok: true, note };
}

/* ═══════════════ plans ═══════════════ */
const PLAN_COLS = ['id', 'ts', 'by', 'title', 'date', 'time', 'place', 'details', 'invited', 'rsvp', 'eventId', 'reminded'];

function addPlan_(b) {
  const p = {
    id: id_(),
    ts: new Date().toISOString(),
    by: clean_(b.by, 30),
    title: clean_(b.title, 80),
    date: String(b.date || ''),
    time: /^\d{2}:\d{2}$/.test(b.time || '') ? b.time : '',
    place: clean_(b.place, 80),
    details: clean_(b.details, 400),
    invited: (b.invited || []).filter((n) => CONFIG.NAMES.includes(n)),
    rsvp: {},
    eventId: '',
    reminded: [],
  };
  if (!p.title) throw new Error('give the plan a name');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date)) throw new Error('pick a date');
  if (!p.invited.length) p.invited = CONFIG.NAMES.slice();
  if (CONFIG.NAMES.includes(p.by)) p.rsvp[p.by] = 'in';

  const ch = b.channels || {};
  const result = { ok: true, emailed: [], invited: [] };
  if (ch.calendar) {
    const guests = emailsFor_(p.invited);
    const start = startOf_(p);
    const ev = p.time
      ? CalendarApp.getDefaultCalendar().createEvent('chawal: ' + p.title, start, new Date(start.getTime() + CONFIG.PLAN_LENGTH_HOURS * 3600e3), { location: p.place, description: describe_(p), guests: guests.join(','), sendInvites: true })
      : CalendarApp.getDefaultCalendar().createAllDayEvent('chawal: ' + p.title, dayOf_(p), { location: p.place, description: describe_(p), guests: guests.join(','), sendInvites: true });
    p.eventId = ev.getId();
    result.invited = guests;
  }
  append_('plans', PLAN_COLS, p);
  if (ch.email) result.emailed = mail_(p.invited, '🍚 new chawal plan: ' + p.title + ' — ' + prettyDate_(p), planEmail_(p, 'new plan alert', (p.by || 'someone') + ' just pinned a plan to the chawal calendar.'));
  result.plan = publicPlan_(p);
  return result;
}

function rsvp_(b) {
  const sh = sheet_('plans', PLAN_COLS);
  const rows = sh.getDataRange().getValues();
  const name = clean_(b.name, 30);
  const status = ['in', 'maybe', 'out'].includes(b.status) ? b.status : '';
  if (!CONFIG.NAMES.includes(name) || !status) throw new Error('bad rsvp');
  for (let r = 1; r < rows.length; r++) {
    if (String(rows[r][0]) !== String(b.id)) continue;
    const p = rowToObj_(rows[r], PLAN_COLS);
    p.rsvp[name] = status;
    if (!p.invited.includes(name)) p.invited.push(name);
    sh.getRange(r + 1, PLAN_COLS.indexOf('rsvp') + 1).setValue(JSON.stringify(p.rsvp));
    sh.getRange(r + 1, PLAN_COLS.indexOf('invited') + 1).setValue(JSON.stringify(p.invited));
    if (CONFIG.RSVP_EMAILS && p.by && p.by !== name) {
      const word = { in: 'is IN 🙌', maybe: 'is a maybe 🤔', out: "can't make it 😢" }[status];
      mail_([p.by], name + ' ' + word.replace(/ [^ ]+$/, '') + ' for ' + p.title, planEmail_(p, name + ' ' + word, 'rsvp update for your plan.'));
    }
    return { ok: true, plan: publicPlan_(p) };
  }
  throw new Error('plan not found');
}

function deletePlan_(b) {
  const sh = sheet_('plans', PLAN_COLS);
  const rows = sh.getDataRange().getValues();
  for (let r = 1; r < rows.length; r++) {
    if (String(rows[r][0]) !== String(b.id)) continue;
    const p = rowToObj_(rows[r], PLAN_COLS);
    if (p.eventId) { try { const ev = CalendarApp.getDefaultCalendar().getEventById(p.eventId); if (ev) ev.deleteEvent(); } catch (err) { /* already gone */ } }
    if (b.notify) mail_(p.invited, '❌ cancelled: ' + p.title, planEmail_(p, 'plan cancelled', (clean_(b.name, 30) || 'someone') + ' cancelled this one. rice is back in the sack.'));
    sh.deleteRow(r + 1);
    return { ok: true };
  }
  return { ok: true };
}

/* ═══════════════ daily reminders (time trigger) ═══════════════ */
function dailyReminders() {
  const tz = CONFIG.TIMEZONE;
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const tomorrow = Utilities.formatDate(new Date(Date.now() + 864e5), tz, 'yyyy-MM-dd');
  const sh = sheet_('plans', PLAN_COLS);
  const rows = sh.getDataRange().getValues();
  for (let r = 1; r < rows.length; r++) {
    const p = rowToObj_(rows[r], PLAN_COLS);
    let tag = '';
    if (p.date === tomorrow && !p.reminded.includes('eve')) tag = 'eve';
    if (p.date === today && !p.reminded.includes('day')) tag = 'day';
    if (!tag) continue;
    const going = p.invited.filter((n) => p.rsvp[n] !== 'out');
    mail_(going, (tag === 'day' ? '⏰ today: ' : '📌 tomorrow: ') + p.title, planEmail_(p, tag === 'day' ? "it's today!!" : "it's tomorrow", tag === 'day' ? 'see you there. no flaking.' : 'just a reminder from the chawal calendar.'));
    p.reminded.push(tag);
    sh.getRange(r + 1, PLAN_COLS.indexOf('reminded') + 1).setValue(JSON.stringify(p.reminded));
  }
}

/* ═══════════════ email ═══════════════ */
function mail_(names, subject, html) {
  const to = emailsFor_(names);
  if (!to.length) return [];
  MailApp.sendEmail({ to: to.join(','), subject, htmlBody: html, name: 'chawal 🍚' });
  return to;
}

function planEmail_(p, headline, lead) {
  const who = p.invited.map((n) => {
    const s = p.rsvp[n];
    const mark = s === 'in' ? '✅' : s === 'maybe' ? '🤔' : s === 'out' ? '❌' : '·';
    return `<span style="display:inline-block;margin:2px 4px;padding:3px 10px;border-radius:99px;background:#fff;border:2px solid #2b2320">${mark} ${esc_(n)}</span>`;
  }).join('');
  const site = siteUrl_();
  const link = site ? `<p style="text-align:center;margin:22px 0 4px"><a href="${esc_(site)}#plans" style="background:#e2483d;color:#fff;text-decoration:none;padding:12px 22px;border-radius:99px;font-weight:bold;border:3px solid #2b2320">open the chawal calendar →</a></p>` : '';
  return `
  <div style="background:#2c6e57;padding:26px 12px;font-family:Georgia,serif">
    <div style="max-width:520px;margin:0 auto;background:#fbf5e8;border-radius:6px;padding:26px 26px 22px;color:#2b2320;box-shadow:0 10px 30px rgba(0,0,0,.3)">
      <div style="font-family:'Courier New',monospace;font-size:12px;letter-spacing:2px;color:#b2281f;text-transform:uppercase">${esc_(headline)}</div>
      <h1 style="font-size:34px;margin:6px 0 4px;line-height:1.05">${esc_(p.title)}</h1>
      <p style="margin:0 0 14px;font-size:15px;color:#5b4d45">${esc_(lead)}</p>
      <table style="font-size:16px;border-collapse:collapse;margin-bottom:12px">
        <tr><td style="padding:3px 12px 3px 0;color:#b2281f">when</td><td><b>${esc_(prettyDate_(p))}</b></td></tr>
        ${p.place ? `<tr><td style="padding:3px 12px 3px 0;color:#b2281f">where</td><td><b>${esc_(p.place)}</b></td></tr>` : ''}
        ${p.by ? `<tr><td style="padding:3px 12px 3px 0;color:#b2281f">planned by</td><td>${esc_(p.by)}</td></tr>` : ''}
      </table>
      ${p.details ? `<p style="background:#ffe680;padding:10px 14px;transform:rotate(-1deg);font-size:15px">${esc_(p.details)}</p>` : ''}
      <div style="margin-top:10px;font-size:14px">${who}</div>
      ${link}
      <p style="font-family:'Courier New',monospace;font-size:11px;color:#8a7a70;text-align:center;margin:18px 0 0">sent by the chawal scrapbook · est. by muhsin</p>
    </div>
  </div>`;
}

/* ═══════════════ helpers ═══════════════ */
function sheet_(name, cols) {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.getRange('A:Z').setNumberFormat('@'); // keep dates as plain text
    sh.setFrozenRows(1);
  }
  return sh;
}
function append_(name, cols, obj) {
  const row = cols.map((c) => (typeof obj[c] === 'object' ? JSON.stringify(obj[c]) : obj[c] == null ? '' : String(obj[c])));
  sheet_(name, cols).appendRow(row);
}
function readAll_(name, cols) {
  const rows = sheet_(name, cols).getDataRange().getValues();
  return rows.slice(1).filter((r) => r[0] !== '').map((r) => rowToObj_(r, cols));
}
function rowToObj_(r, cols) {
  const o = {};
  cols.forEach((c, i) => {
    let v = r[i];
    if (v instanceof Date) v = c === 'time' ? Utilities.formatDate(v, CONFIG.TIMEZONE, 'HH:mm') : Utilities.formatDate(v, CONFIG.TIMEZONE, 'yyyy-MM-dd');
    if (['invited', 'reminded'].includes(c)) { try { v = JSON.parse(v || '[]'); } catch (err) { v = []; } }
    if (c === 'rsvp') { try { v = JSON.parse(v || '{}'); } catch (err) { v = {}; } }
    o[c] = v == null ? '' : v;
  });
  return o;
}
function deleteRow_(name, cols, id) {
  const sh = sheet_(name, cols);
  const rows = sh.getDataRange().getValues();
  for (let r = 1; r < rows.length; r++) if (String(rows[r][0]) === String(id)) { sh.deleteRow(r + 1); break; }
  return { ok: true };
}
function publicPlan_(p) {
  const { eventId, reminded, ...rest } = p;
  return Object.assign(rest, { hasInvite: !!eventId });
}
function emailsFor_(names) {
  const book = members_();
  return (names || []).map((n) => book[n]).filter((e) => e && /@/.test(e));
}
let cache_ = null;
function kv_() {
  if (cache_) return cache_;
  cache_ = { settings: {}, members: {} };
  readRows_('settings').forEach((r) => { cache_.settings[String(r[0]).trim().toLowerCase()] = String(r[1] || '').trim(); });
  readRows_('members').forEach((r) => { if (r[0]) cache_.members[String(r[0]).trim()] = String(r[1] || '').trim(); });
  return cache_;
}
function readRows_(name) {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(name);
  return sh ? sh.getDataRange().getValues().slice(1) : [];
}
function members_() { return kv_().members; }
function passcode_() { const c = kv_().settings.passcode; if (!c) throw new Error('no passcode set — run setup()'); return c; }
function siteUrl_() { const u = kv_().settings.site_url || ''; return /^https?:\/\//.test(u) ? u : ''; }
function dayOf_(p) { const [y, m, d] = p.date.split('-').map(Number); return new Date(y, m - 1, d); }
function startOf_(p) {
  const [y, m, d] = p.date.split('-').map(Number);
  const [hh, mm] = (p.time || '00:00').split(':').map(Number);
  // build the time in the group's timezone, whatever the script's own zone is
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const offset = Utilities.formatDate(guess, CONFIG.TIMEZONE, 'Z'); // e.g. +0530
  const sign = offset[0] === '-' ? -1 : 1;
  const mins = sign * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(3, 5)));
  return new Date(guess.getTime() - mins * 60e3);
}
function prettyDate_(p) {
  const d = startOf_(p);
  const day = Utilities.formatDate(d, CONFIG.TIMEZONE, 'EEE d MMM');
  return p.time ? day + ', ' + Utilities.formatDate(d, CONFIG.TIMEZONE, 'h:mm a').toLowerCase() : day;
}
function describe_(p) {
  return [p.details, 'planned by ' + (p.by || 'chawal'), siteUrl_()].filter(String).join('\n\n');
}
function clean_(s, max) { return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, max); }
function esc_(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function id_() { return Utilities.getUuid().slice(0, 8); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
