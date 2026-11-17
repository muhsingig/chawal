/* CHAWAL — the page-flip book engine
   pages (#pages > .page) get bound into leaves: front = right-hand page, back = next left-hand page.
   spread mode (wide screens): two pages side by side. single mode (phones): one page at a time. */
window.Book = (() => {
  const PW = 620, PH = 820;
  const DUR = 950, FAST = 430;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s) => document.querySelector(s);
  const pages = [...document.querySelectorAll('#pages > .page')];
  const leavesEl = $('#leaves');
  const book = $('#book');
  const wrap = $('#bookWrap');
  const listeners = { show: [], turn: [] };
  let mode = '';
  let leaves = [];
  let cur = 0;      // spread: leaves turned · single: page index
  let scale = 1;
  let started = false;

  const max = () => (mode === 'spread' ? leaves.length : pages.length - 1);
  const visible = () => (mode === 'spread' ? [2 * cur - 1, 2 * cur].filter((i) => i >= 0 && i < pages.length) : [cur]);
  const curForPage = (p) => (mode === 'spread' ? Math.ceil(p / 2) : p);
  const emit = (ev, ...a) => listeners[ev].forEach((f) => f(...a));

  pages.forEach((p, i) => { p.dataset.index = i; });

  /* ───────── build leaves ───────── */
  function build() {
    leavesEl.innerHTML = '';
    leaves = [];
    const n = mode === 'spread' ? Math.ceil(pages.length / 2) : pages.length;
    for (let i = 0; i < n; i++) {
      const leaf = document.createElement('div');
      leaf.className = 'leaf';
      const front = document.createElement('div');
      front.className = 'face front';
      const back = document.createElement('div');
      back.className = 'face back';
      if (mode === 'spread') {
        front.appendChild(pages[2 * i]);
        if (pages[2 * i + 1]) back.appendChild(pages[2 * i + 1]);
      } else {
        front.appendChild(pages[i]);
        back.innerHTML = '<div class="page page--blank"></div>';
      }
      if (front.firstElementChild.classList.contains('page--cover')) front.classList.add('is-cover');
      if (back.firstElementChild && back.firstElementChild.classList.contains('page--cover')) back.classList.add('is-cover');
      leaf.append(front, back);
      leavesEl.appendChild(leaf);
      leaves.push(leaf);
    }
    book.classList.toggle('is-single', mode === 'single');
    book.classList.toggle('is-spread', mode === 'spread');
  }

  /* ───────── state → DOM ───────── */
  function render() {
    const n = leaves.length;
    leaves.forEach((lf, i) => {
      const flipped = i < cur;
      lf.classList.toggle('flipped', flipped);
      const near = mode === 'spread' ? i >= cur - 2 && i <= cur + 1 : i >= cur - 1 && i <= cur + 1;
      lf.style.display = near || lf.dataset.turning ? '' : 'none';
      if (!lf.dataset.turning) lf.style.zIndex = flipped ? i + 1 : n - i + 1;
    });
    // closed book slides to the middle
    let shift = 0;
    if (mode === 'spread' && cur === 0) shift = -PW / 2;
    if (mode === 'spread' && cur === n) shift = PW / 2;
    book.style.transform = `translateX(${shift}px)`;
    book.classList.toggle('closed', mode === 'spread' ? cur === 0 || cur === n : cur === 0 || cur === pages.length - 1);
    book.classList.toggle('at-start', cur === 0);
    document.body.classList.toggle('at-cover', cur === 0);
    book.classList.toggle('at-end', cur === max());
    // page-edge thickness
    const left = mode === 'spread' ? cur : cur;
    const right = mode === 'spread' ? n - cur : pages.length - 1 - cur;
    book.style.setProperty('--tl', `${Math.min(9, Math.round(left / 2))}px`);
    book.style.setProperty('--tr', `${Math.min(9, Math.round(right / 2))}px`);
    $('#prevBtn').disabled = cur === 0;
    $('#nextBtn').disabled = cur === max();
    const vis = visible().map((i) => pages[i].dataset.name).filter(Boolean);
    $('#whereText').textContent = [...new Set(vis)].join(' / ') || 'cover';
    markRibbons();
  }

  function setLive() {
    const vis = new Set(visible());
    setTimeout(() => {
      vis.forEach((i) => {
        const p = pages[i];
        if (!p.classList.contains('live')) { p.classList.add('live'); emit('show', p, i); }
      });
    }, 40);
    return vis;
  }
  function clearLive() {
    const vis = new Set(visible());
    pages.forEach((p, i) => { if (!vis.has(i) && p.classList.contains('live')) p.classList.remove('live'); });
  }

  /* ───────── turning ───────── */
  function turn(dir, fast = false) {
    const target = cur + dir;
    if (target < 0 || target > max()) return false;
    const leaf = mode === 'spread' ? (dir > 0 ? leaves[cur] : leaves[cur - 1]) : (dir > 0 ? leaves[cur] : leaves[cur - 1]);
    leaf.dataset.turning = '1';
    leaf.style.zIndex = 900;
    leaf.classList.toggle('fast', fast);
    leaf.classList.remove('turning'); void leaf.offsetWidth; leaf.classList.add('turning');
    cur = target;
    render();
    setLive();
    sound(fast);
    emit('turn', cur);
    clearTimeout(leaf._t);
    leaf._t = setTimeout(() => {
      delete leaf.dataset.turning;
      leaf.classList.remove('turning', 'fast');
      render();
      clearLive();
    }, reduce ? 30 : fast ? FAST + 40 : DUR + 40);
    return true;
  }
  let riffle = null;
  function goToCur(target) {
    clearInterval(riffle);
    target = Math.max(0, Math.min(max(), target));
    if (target === cur) return;
    const steps = Math.abs(target - cur);
    if (steps === 1) { turn(Math.sign(target - cur)); return; }
    const dir = Math.sign(target - cur);
    turn(dir, true);
    riffle = setInterval(() => { if (cur === target || !turn(dir, true)) clearInterval(riffle); }, 110);
  }
  const goToPage = (p) => goToCur(curForPage(p));

  /* ───────── drag the corner ───────── */
  function cornerDrag(hot, dir) {
    hot.addEventListener('pointerdown', (e) => {
      if (dir > 0 && cur >= max()) return;
      if (dir < 0 && cur <= 0) return;
      e.preventDefault();
      hot.setPointerCapture(e.pointerId);
      const sx = e.clientX;
      const rect = book.getBoundingClientRect();
      const span = (mode === 'spread' ? rect.width / 2 : rect.width) * 1.5;
      const canDrag = mode === 'spread' || dir > 0;
      const leaf = dir > 0 ? leaves[cur] : leaves[cur - 1];
      let prog = 0, moved = false;
      if (canDrag) {
        leaf.classList.add('dragging');
        leaf.style.zIndex = 900;
        // reveal what's underneath
        const peek = dir > 0 ? leaves[cur + 1] : leaves[cur - 2];
        if (peek) peek.style.display = '';
      }
      const move = (ev) => {
        if (!canDrag) return;
        const dx = (ev.clientX - sx) * -dir;
        if (Math.abs(dx) > 4) moved = true;
        prog = Math.max(0, Math.min(1, dx / span));
        const ang = dir > 0 ? -180 * prog : -180 + 180 * prog;
        leaf.style.transform = `rotateY(${ang}deg)`;
        leaf.style.setProperty('--curl', prog.toFixed(3));
      };
      const up = () => {
        hot.removeEventListener('pointermove', move);
        hot.removeEventListener('pointerup', up);
        hot.removeEventListener('pointercancel', up);
        leaf.classList.remove('dragging');
        leaf.style.transform = '';
        if (!moved || prog > .28) turn(dir);
        else { render(); }
      };
      hot.addEventListener('pointermove', move);
      hot.addEventListener('pointerup', up);
      hot.addEventListener('pointercancel', up);
    });
  }
  cornerDrag($('#hotR'), 1);
  cornerDrag($('#hotL'), -1);

  // swipe on touch, as long as it didn't start on something interactive
  let sw = null;
  leavesEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    if (e.target.closest('[data-noswipe], input, textarea, select, button, a, canvas, video, .member, [data-lb], [data-lb-src]')) return;
    sw = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  leavesEl.addEventListener('pointerup', (e) => {
    if (!sw) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (Math.abs(dx) > 45 && Math.abs(dy) < Math.abs(dx) * .7 && performance.now() - sw.t < 800) turn(dx < 0 ? 1 : -1);
    sw = null;
  });
  // clicking the closed cover opens it
  leavesEl.addEventListener('click', (e) => {
    const face = e.target.closest('.face');
    if (!face || !face.classList.contains('is-cover')) return;
    if (e.target.closest('[data-lb], button')) return;
    if (cur === 0) turn(1);
    else if (cur === max()) turn(-1);
  });

  $('#prevBtn').onclick = () => turn(-1);
  $('#nextBtn').onclick = () => turn(1);
  addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (!$('#modal').hidden || !$('#lightbox').hidden) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); turn(1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); turn(-1); }
    if (e.key === 'Home') goToCur(0);
    if (e.key === 'End') goToCur(max());
  });

  /* ───────── bookmarks + contents ───────── */
  const tabbed = pages.map((p, i) => ({ p, i })).filter(({ p }) => p.dataset.tab);
  const COLORS = ['#f2b632', '#8fb85f', '#f4b8c4', '#8fb8de', '#7fd1c1', '#c9a87a', '#b79ce0', '#ffd27a', '#ef6b4f'];
  const ribbons = $('#ribbons');
  ribbons.innerHTML = tabbed.map(({ p, i }, k) => `<button type="button" class="ribbon-tab" data-p="${i}" style="--tab:${COLORS[k % COLORS.length]};--k:${k}">${p.dataset.tab}</button>`).join('');
  ribbons.addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (b) goToPage(+b.dataset.p); });
  function markRibbons() {
    const vis = visible();
    [...ribbons.children].forEach((b) => {
      const pi = +b.dataset.p;
      b.classList.toggle('on', vis.includes(pi));
    });
  }
  const toc = $('#toc');
  toc.innerHTML = [{ p: pages[0], i: 0 }, ...tabbed].map(({ p, i }) => `<button type="button" data-p="${i}">${i === 0 ? 'cover' : p.dataset.name}<span>p.${i}</span></button>`).join('');
  $('#whereBtn').onclick = () => { toc.hidden = !toc.hidden; $('#whereBtn').setAttribute('aria-expanded', String(!toc.hidden)); };
  toc.addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (!b) return; toc.hidden = true; goToPage(+b.dataset.p); });
  document.addEventListener('click', (e) => { if (!toc.hidden && !e.target.closest('#bookNav')) toc.hidden = true; });

  /* ───────── paper sound (synthesised, no files) ───────── */
  let ac = null, noise = null;
  let soundOn = true;
  try { soundOn = localStorage.getItem('chawal-sound') !== 'off'; } catch { /* noop */ }
  const sBtn = $('#soundBtn');
  const paintSound = () => { sBtn.classList.toggle('off', !soundOn); sBtn.setAttribute('aria-pressed', String(soundOn)); sBtn.setAttribute('aria-label', soundOn ? 'page sounds on' : 'page sounds off'); };
  paintSound();
  sBtn.onclick = () => { soundOn = !soundOn; try { localStorage.setItem('chawal-sound', soundOn ? 'on' : 'off'); } catch { /* noop */ } paintSound(); };
  function sound(fast) {
    if (!soundOn) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (!noise) {
        noise = ac.createBuffer(1, ac.sampleRate * .6, ac.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      }
      const t = ac.currentTime;
      const len = fast ? .22 : .42;
      const src = ac.createBufferSource(); src.buffer = noise;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = .9;
      bp.frequency.setValueAtTime(3800, t); bp.frequency.exponentialRampToValueAtTime(700, t + len);
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(fast ? .1 : .2, t + .04);
      g.gain.setValueAtTime(fast ? .08 : .16, t + len * .5);
      g.gain.exponentialRampToValueAtTime(.001, t + len);
      src.connect(bp); bp.connect(g); g.connect(ac.destination);
      src.start(t); src.stop(t + len + .05);
    } catch { /* audio not available */ }
  }

  /* ───────── fit to screen ───────── */
  function fit() {
    const navH = 76;
    const aw = innerWidth - 24, ah = innerHeight - navH - 24;
    const want = aw / ah > 1.05 && aw >= 700 ? 'spread' : 'single';
    if (want !== mode) {
      const page = mode ? (mode === 'spread' ? (cur === 0 ? 0 : 2 * cur - 1) : cur) : 0;
      mode = want;
      build();
      cur = curForPage(page);
      cur = Math.max(0, Math.min(max(), cur));
      pages.forEach((p) => p.classList.remove('live'));
      render();
      if (started) setLive();
    }
    const bw = mode === 'spread' ? PW * 2 + 90 : PW + 16;
    scale = Math.min(aw / bw, ah / (PH + 16));
    wrap.style.setProperty('--s', scale.toFixed(4));
    wrap.style.width = `${(mode === 'spread' ? PW * 2 : PW) * scale}px`;
    wrap.style.height = `${PH * scale}px`;
  }
  addEventListener('resize', fit);
  fit();

  function start() {
    if (started) return;
    started = true;
    document.body.classList.add('book-ready');
    const h = decodeURIComponent(location.hash.slice(1));
    const target = h && pages.findIndex((p) => p.dataset.hash === h || p.dataset.tab === h);
    if (target > 0) { setLive(); setTimeout(() => goToPage(target), 500); }
    else setLive();
  }

  return {
    start,
    turn,
    goToPage,
    on: (ev, f) => listeners[ev].push(f),
    pages,
    get mode() { return mode; },
  };
})();
