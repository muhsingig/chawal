/* CHAWAL scrapbook — everything that lives on the pages */
(() => {
  const D = window.CHAWAL;
  const Book = window.Book;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };

  /* ───────────── rice fx (canvas) ───────────── */
  const cv = $('#fx');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, running = false;
  const parts = [];
  function resizeFx() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeFx();
  addEventListener('resize', resizeFx);
  function spawn(p) {
    parts.push(Object.assign({ rot: rand(0, 6.28), vr: rand(-.25, .25), life: 0, max: 160, size: rand(3.6, 5.4), kind: 'grain', g: .22 }, p));
    if (!running) { running = true; requestAnimationFrame(tick); }
  }
  function heartPath(s) {
    ctx.beginPath();
    ctx.moveTo(0, s * .35);
    ctx.bezierCurveTo(-s * 1.2, -s * .4, -s * .5, -s * 1.15, 0, -s * .45);
    ctx.bezierCurveTo(s * .5, -s * 1.15, s * 1.2, -s * .4, 0, s * .35);
  }
  function tick() {
    ctx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.vy += p.g; p.vx *= .985; p.vy *= .995;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life++;
      if (p.life > p.max || p.y > H + 40) { parts.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.min(1, (p.max - p.life) / 30);
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      if (p.kind === 'heart') {
        heartPath(p.size * 2.2);
        ctx.fillStyle = p.color || '#e2483d'; ctx.fill();
        ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(80,10,10,.5)'; ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * .42, p.size, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#fffaf0'; ctx.fill();
        ctx.lineWidth = .9; ctx.strokeStyle = 'rgba(60,40,20,.45)'; ctx.stroke();
      }
      ctx.restore();
    }
    if (parts.length) requestAnimationFrame(tick);
    else { running = false; ctx.clearRect(0, 0, W, H); }
  }
  function burst(x, y, n = 80, { power = 9, up = true, hearts = 0 } = {}) {
    if (reduce) n = Math.min(n, 12);
    for (let i = 0; i < n; i++) {
      const ang = up ? rand(-Math.PI * .95, -Math.PI * .05) : rand(0, Math.PI * 2);
      const v = rand(power * .35, power);
      spawn({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, max: rand(90, 170), kind: Math.random() < hearts ? 'heart' : 'grain', color: pick(['#e2483d', '#f4b8c4', '#ef6b4f']) });
    }
  }
  function rain(n = 250) {
    if (reduce) n = 20;
    for (let i = 0; i < n; i++) setTimeout(() => spawn({ x: rand(0, W), y: rand(-60, -10), vx: rand(-1, 1), vy: rand(1, 5), g: rand(.08, .18), max: 400 }), rand(0, 1400));
  }
  window.ChawalFX = { burst, rain };

  let lastTrail = 0;
  addEventListener('pointermove', (e) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const now = performance.now();
    if (now - lastTrail < 55) return;
    lastTrail = now;
    spawn({ x: e.clientX + rand(-4, 4), y: e.clientY + rand(-4, 4), vx: rand(-.6, .6), vy: rand(-1.4, -.2), g: .12, max: 55, size: rand(3, 4.2) });
  }, { passive: true });

  let typed = '';
  addEventListener('keydown', (e) => {
    if (e.key.length !== 1 || (e.target.closest && e.target.closest('input, textarea'))) return;
    typed = (typed + e.key.toLowerCase()).slice(-6);
    if (typed === 'chawal') { rain(380); typed = ''; }
  });

  /* ───────────── ransom-note titles ───────────── */
  const RF = ["'Shrikhand'", "'Special Elite'", "'Abril Fatface'", "'Bungee'", "'Caveat'", "'Gochi Hand'"];
  const RP = [['#e2483d', '#fff'], ['#f2b632', '#2b2320'], ['#fffaf0', '#2b2320'], ['#2b2320', '#fffaf0'], ['#8fb85f', '#2b2320'], ['#a9cbe8', '#2b2320'], ['#f4b8c4', '#2b2320'], ['#4f7cc2', '#fff'], ['#fff', '#e2483d']];
  $$('.ransom').forEach((h) => {
    const text = h.dataset.text || h.textContent;
    h.setAttribute('aria-label', text);
    let k = 0;
    h.innerHTML = text.split(' ').map((w) => '<span class="w" aria-hidden="true">' + [...w].map((ch) => {
      const [bg, fg] = pick(RP);
      const f = pick(RF);
      const big = f.includes('Caveat') || f.includes('Gochi') ? 1.25 : 1;
      return `<span class="l" style="font-family:${f};background:${bg};color:${fg};font-size:${(rand(.82, 1.14) * big).toFixed(2)}em;--lr:${rand(-9, 9).toFixed(1)}deg;--ly:${rand(-5, 5).toFixed(0)}px;--i:${k++}">${ch}</span>`;
    }).join('') + '</span>').join(' ');
  });

  /* ───────────── torn paper edges ───────────── */
  function tornClip() {
    const pts = [], n = 22;
    for (let i = 0; i <= n; i++) pts.push(`${(i / n * 100).toFixed(1)}% ${rand(0, 2.4).toFixed(2)}%`);
    for (let i = 1; i <= n; i++) pts.push(`${(100 - rand(0, 1.8)).toFixed(2)}% ${(i / n * 100).toFixed(1)}%`);
    for (let i = n - 1; i >= 0; i--) pts.push(`${(i / n * 100).toFixed(1)}% ${(100 - rand(0, 2.4)).toFixed(2)}%`);
    for (let i = n - 1; i >= 1; i--) pts.push(`${rand(0, 1.8).toFixed(2)}% ${(i / n * 100).toFixed(1)}%`);
    return `polygon(${pts.join(',')})`;
  }
  $$('.torn').forEach((f) => {
    const inner = document.createElement('div');
    inner.className = 'torn-inner';
    while (f.firstChild) inner.appendChild(f.firstChild);
    f.appendChild(inner);
    inner.style.clipPath = tornClip();
  });

  /* ───────────── marigold garlands ───────────── */
  $$('.garland').forEach((g) => {
    const host = g.parentElement;
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const yv = (1 - t) ** 2 * 10 + 2 * (1 - t) * t * 140 + t * t * 10;
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      el.setAttribute('viewBox', '0 0 100 100');
      el.setAttribute('class', 'g-flower');
      el.innerHTML = '<use href="#d-flower"/>';
      el.style.left = `${(t * 620 - 15).toFixed(1)}px`;
      el.style.top = `${(yv / 120 * 110 - 15).toFixed(1)}px`;
      el.style.fill = ['#f6a21a', '#fbd34d', '#ef6b4f'][i % 3];
      el.style.setProperty('--gi', i);
      el.style.transform = `rotate(${rand(0, 360).toFixed(0)}deg)`;
      host.appendChild(el);
    }
  });

  /* ───────────── contents page ───────────── */
  $('#contents').innerHTML = Book.pages.map((p, i) => ({ p, i })).filter(({ p }) => p.dataset.tab && p.dataset.tab !== 'hello')
    .map(({ p, i }) => `<li><button type="button" data-p="${i}"><span>${p.dataset.name}</span><i></i><em>p.${i}</em></button></li>`).join('');
  $('#contents').addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (b) Book.goToPage(+b.dataset.p); });

  /* ───────────── members ───────────── */
  const grid = $('#grainsGrid');
  const statColors = ['#e2483d', '#f2b632', '#4f7cc2'];
  D.members.forEach((m, i) => {
    const el = document.createElement('div');
    el.className = 'member drop';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', `${m.name}, ${m.ingredient}. flip for more`);
    el.style.setProperty('--r', `${m.tilt}deg`);
    el.style.setProperty('--d', `${.2 + i * .12}s`);
    const stats = Object.entries(m.stats).map(([k, v], j) => `<div class="stat"><span>${k}</span><i style="--v:${v}%;--c:${statColors[j % 3]}"></i></div>`).join('');
    el.innerHTML = `
      <span class="tape tape--${m.tape}"></span>
      <div class="inner">
        <div class="face-m">
          <img src="${m.face}" alt="${m.name}" loading="lazy">
          <p class="m-name">${m.name}</p>
          <p class="m-role">${m.ingredient}</p>
        </div>
        <div class="back">
          <h4>${m.name}<small>ingredient: ${m.ingredient}</small></h4>
          <p>${m.blurb}</p>
          <p class="likely"><b>MOST LIKELY TO</b>${m.likely}</p>
          <div class="stats">${stats}</div>
        </div>
      </div>`;
    const flip = (e) => {
      e.stopPropagation();
      el.classList.toggle('flipped');
      const r = el.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + 20, 14, { power: 5 });
    };
    el.addEventListener('click', flip);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(e); } });
    grid.appendChild(el);
  });
  $('#heartImg').src = D.heart.sticker;
  $('#heartImg').alt = D.heart.name;
  $('.heart-name').innerHTML = `${D.heart.name}<small>${D.heart.ingredient}</small>`;
  $('.heart-line').textContent = D.heart.line;
  $('#heartWrap').addEventListener('click', () => {
    const r = $('.heart-scribble').getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, 70, { power: 11, up: false, hearts: .55 });
  });

  // red string: drawn in "spread" coordinates on both pages so it runs across the gutter
  function offsetIn(el, root) {
    let x = 0, y = 0, n = el;
    while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }
  function drawStrings() {
    const pL = $('#heartWrap').closest('.page');
    const pR = grid.closest('.page');
    if (!pL.offsetWidth || !pR.offsetWidth) return;
    const hs = offsetIn($('.heart-scribble'), pL);
    const hx = hs.x + hs.w / 2, hy = hs.y + hs.h * .52;
    const ga = offsetIn(grid, pR);
    let pathsL = '', pathsR = '';
    $$('.member', grid).forEach((m, i) => {
      const px = 620 + ga.x + m.offsetLeft + m.offsetWidth / 2;
      const py = ga.y + m.offsetTop + 14;
      const mx = (hx + px) / 2, my = Math.max(hy, py) + 50 + i * 18;
      const d = `M${hx} ${hy}Q${mx} ${my} ${px} ${py}`;
      pathsL += `<path d="${d}" pathLength="1" style="--sd:${(i * .15 + .3).toFixed(2)}s"/>`;
      pathsR += `<path d="${d}" pathLength="1" style="--sd:${(i * .15 + .3).toFixed(2)}s"/><circle class="pin" cx="${px}" cy="${py}" r="7"/><circle class="shine" cx="${px - 2}" cy="${py - 2}" r="2"/>`;
    });
    $('#stringsL').innerHTML = `<g>${pathsL}</g>`;
    $('#stringsR').innerHTML = `<g transform="translate(-620 0)">${pathsR}</g>`;
  }
  Book.on('show', (p) => { if (p.contains($('#heartWrap')) || p.contains(grid)) requestAnimationFrame(drawStrings); });
  if (document.fonts) document.fonts.ready.then(drawStrings);

  /* ───────────── lightbox ───────────── */
  const lb = $('#lightbox');
  function openLb(src, cap) {
    $('#lbImg').src = src;
    $('#lbImg').alt = cap || '';
    $('#lbCap').textContent = cap || '';
    lb.hidden = false;
    $('#lbClose').focus();
  }
  const closeLb = () => { lb.hidden = true; };
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-lb], [data-lb-src]');
    if (!t || t.closest('.desk') || t.closest('.leaf[data-turning]')) return;
    openLb(t.dataset.lbSrc || t.currentSrc || t.src, t.dataset.cap || t.alt);
  });
  lb.addEventListener('click', (e) => { if (e.target === lb || e.target.id === 'lbClose') closeLb(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lb.hidden) closeLb(); });

  /* ───────────── recipe ticks ───────────── */
  const ing = $$('#ingredients li');
  ing.forEach((li) => li.querySelector('button').addEventListener('click', (e) => {
    li.classList.toggle('done');
    burst(e.clientX, e.clientY, 10, { power: 4 });
    if (ing.every((x) => x.classList.contains('done'))) {
      const r = $('.recipe-card').getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + 40, 120, { power: 12, hearts: .2 });
    }
  }));

  /* ───────────── messy desk ───────────── */
  const desk = $('#deskArea');
  const STK = {
    heart: { sym: 'd-heart', fill: '#e2483d' },
    star: { sym: 'd-star', fill: '#f2b632' },
    sparkle: { sym: 'd-sparkle', fill: '#f4b8c4' },
    crown: { sym: 'd-crown', fill: '#f2b632' },
    bowl: { sym: 'd-bowl', fill: '#fffaf0' },
    flower: { sym: 'd-flower', fill: '#f08a24' },
    kiss: { sym: 'd-kiss', fill: '#e2483d' },
    grain: { sym: 'd-grain', fill: '#fffaf0' },
    argentina: { img: 'assets/people/group-argentina.webp', big: true },
    trad: { img: 'assets/people/group-traditional.webp', big: true },
    rider: { img: 'assets/people/horse-rider.webp', big: true },
  };
  const stkHTML = (k) => {
    const s = STK[k];
    if (s.img) return `<img src="${s.img}" alt="" draggable="false">`;
    return `<svg class="stk" viewBox="0 0 100 100"><use href="#${s.sym}" class="bg" fill="#fffdf6"/><use href="#${s.sym}" class="fg" fill="${s.fill}"/></svg>`;
  };
  const KEY = 'chawal-desk-v2';
  let topZ = 100;
  function freshState() {
    const photos = D.photos.map((p, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      return { i, x: col * 24 + rand(-1, 5), y: row * 23 + rand(0, 6), r: rand(-14, 14), z: i + 1 };
    });
    return { photos, stickers: [
      { k: 'crown', x: 34, y: 40, r: -6, z: 50 },
      { k: 'heart', x: 66, y: 14, r: 12, z: 51 },
      { k: 'star', x: 8, y: 70, r: -10, z: 52 },
    ] };
  }
  let state = store.get(KEY);
  if (!state || !Array.isArray(state.photos) || state.photos.length !== D.photos.length) state = freshState();
  topZ = Math.max(100, ...state.photos.map((p) => p.z), ...state.stickers.map((s) => s.z));
  const save = () => store.set(KEY, state);

  const tray = $('#tray');
  Object.keys(STK).forEach((k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.title = `stick a ${k}`;
    b.setAttribute('aria-label', `add ${k} sticker`);
    b.innerHTML = stkHTML(k);
    b.addEventListener('click', () => {
      state.stickers.push({ k, x: rand(15, 60), y: rand(15, 60), r: rand(-20, 20), z: ++topZ });
      save(); renderDesk();
      b.classList.remove('peeled'); void b.offsetWidth; b.classList.add('peeled');
      const r = b.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top, 12, { power: 5 });
    });
    tray.appendChild(b);
  });

  function place(el, o) {
    el.style.left = o.x + '%';
    el.style.top = o.y + '%';
    el.style.transform = `rotate(${o.r}deg)`;
    el.style.zIndex = o.z;
  }
  function renderDesk() {
    desk.innerHTML = '';
    state.photos.forEach((o, n) => {
      const p = D.photos[o.i];
      const el = document.createElement('div');
      el.className = 'd-item d-photo';
      el.style.setProperty('--dd', `${(n * .04).toFixed(2)}s`);
      el.innerHTML = `<img src="${p.src}" alt="${p.cap}" loading="lazy" draggable="false"><span>${p.cap}</span>`;
      place(el, o); makeDraggable(el, o, false);
      desk.appendChild(el);
    });
    state.stickers.forEach((o) => {
      if (!STK[o.k]) return;
      const el = document.createElement('div');
      el.className = 'd-item d-sticker' + (STK[o.k].big ? ' big' : '');
      el.innerHTML = stkHTML(o.k);
      place(el, o); makeDraggable(el, o, true);
      desk.appendChild(el);
    });
  }
  function makeDraggable(el, o, isSticker) {
    let lastTap = 0;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      const dr = desk.getBoundingClientRect();
      const sx = e.clientX, sy = e.clientY, ox = o.x, oy = o.y;
      let moved = false;
      o.z = ++topZ; el.style.zIndex = o.z;
      el.classList.add('grab');
      const move = (ev) => {
        const dx = (ev.clientX - sx) / dr.width * 100, dy = (ev.clientY - sy) / dr.height * 100;
        if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 3) moved = true;
        o.x = Math.max(-10, Math.min(88, ox + dx));
        o.y = Math.max(-6, Math.min(90, oy + dy));
        el.style.left = o.x + '%'; el.style.top = o.y + '%';
      };
      const up = () => {
        el.classList.remove('grab');
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        if (!moved) {
          const now = performance.now();
          if (isSticker && now - lastTap < 350) {
            state.stickers = state.stickers.filter((s) => s !== o);
            const r = el.getBoundingClientRect();
            burst(r.left + r.width / 2, r.top + r.height / 2, 18, { power: 6, up: false });
            el.remove();
          } else if (!isSticker) { o.r = rand(-14, 14); el.style.transform = `rotate(${o.r}deg)`; }
          lastTap = now;
        }
        save();
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
  }
  $('#shuffleBtn').addEventListener('click', () => {
    const fresh = freshState().photos;
    const order = fresh.map((_, j) => j).sort(() => Math.random() - .5);
    state.photos = fresh.map((p, j) => ({ ...p, i: order[j], z: ++topZ }));
    save(); renderDesk();
  });
  $('#clearBtn').addEventListener('click', () => { state.stickers = []; save(); renderDesk(); });
  renderDesk();

  /* ───────────── screening room ───────────── */
  const shelf = $('#shelf');
  const video = $('#tvVideo');
  const tv = $('#tv');
  D.tapes.forEach((t, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'vhs drop' + (t.src ? '' : ' empty');
    b.style.setProperty('--tc', t.color);
    b.style.setProperty('--d', `${.15 + i * .12}s`);
    b.style.setProperty('--r', `${[-1.5, 1, -.5, 1.5][i % 4]}deg`);
    b.innerHTML = `<div class="lbl"><b>${t.title}</b><small>${t.sub}</small></div><div class="reels"><i></i><i></i></div>`;
    b.addEventListener('click', () => {
      $$('.vhs', shelf).forEach((x) => x.classList.remove('loaded'));
      b.classList.add('loaded');
      $('#tvLabel').textContent = `ch. ${String(i + 1).padStart(2, '0')} — ${t.title}`;
      if (!t.src) {
        video.pause(); video.removeAttribute('src'); video.load();
        $('#tvStatic').classList.remove('off');
        $('#tvStatic span').textContent = 'blank tape — add an edit!';
        tv.classList.remove('playing');
        return;
      }
      $('#tvStatic').classList.remove('off');
      $('#tvStatic span').textContent = 'tracking…';
      video.poster = t.poster || '';
      video.src = t.src;
      video.play().catch(() => {});
      setTimeout(() => $('#tvStatic').classList.add('off'), 450);
      tv.classList.add('playing');
    });
    shelf.appendChild(b);
  });
  Book.on('turn', () => { if (!video.paused && !tv.closest('.page').classList.contains('live')) video.pause(); });

  /* ───────────── fin + pocket ───────────── */
  $('#throwBtn').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top, 160, { power: 15, hearts: .12 });
    setTimeout(() => rain(160), 300);
  });
  $('#pocket').addEventListener('click', () => $('#pocket').classList.toggle('out'));

  /* ───────────── loader → open on the cover ───────────── */
  const loader = $('#loader');
  const pctEl = $('#loadPct');
  const t0 = performance.now();
  let loaded = document.readyState === 'complete', finished = false;
  addEventListener('load', () => { loaded = true; });
  function finish() {
    if (finished) return;
    finished = true;
    loader.classList.add('done');
    document.body.classList.add('ready');
    Book.start();
  }
  (function step() {
    if (finished) return;
    const el = performance.now() - t0;
    const target = loaded ? 100 : Math.min(92, el / 25);
    const now = Math.min(100, Math.max(+pctEl.textContent, Math.round(target)));
    pctEl.textContent = now;
    if ((now >= 100 && el > 1100) || el > 5000) finish();
    else setTimeout(step, 30);
  })();
  loader.addEventListener('click', finish);
})();
