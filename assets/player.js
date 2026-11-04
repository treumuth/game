'use strict';
const P = {id: +localStorage.getItem('vq_pid') || 0, token: localStorage.getItem('vq_tok') || '', st: null, key: '', answered: false, busy: false, cleanup: null, joinType: 'solo', avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)], lastTick: -1, lastIntroTip: -1, lastPhaseSound: ''};
const app = $('#app');
bubbles(12);

function setNet(ok) { $('#net').classList.toggle('show', !ok); }
function clean() { if (P.cleanup) { try { P.cleanup(); } catch (e) {} P.cleanup = null; } }
function viewKey(s) {
  if (!s.me) return 'join';
  if (s.status === 'lobby') return 'lobby:' + s.round;
  if (s.status === 'ended') return 'ended:' + s.round;
  return 'run:' + s.round + ':' + s.q_index + ':' + s.phase;
}
function meBar(s) {
  const m = s.me;
  return `<div class="me-chip"><div class="who"><span class="ava">${esc(m.avatar)}</span>${esc(m.name)}${m.type === 'team' ? ' <span class="pill" style="font-size:.75rem">👥 tiim</span>' : ''}</div><span class="pill">⭐ ${fmtNum(m.score)}</span></div>`;
}

async function poll() {
  if (P.busy) return; P.busy = true;
  try {
    const s = await API.get('state', {role: 'player', pid: P.id, token: P.token});
    if (!s.ok) throw new Error(s.error);
    setNet(true);
    if (!s.me && P.id) { P.id = 0; P.token = ''; localStorage.removeItem('vq_pid'); localStorage.removeItem('vq_tok'); P.kicked = true; }
    P.st = s;
    applyTheme(s);
    const k = viewKey(s);
    if (k !== P.key) { P.key = k; P.answered = false; P.lastIntroTip = -1; P.lastTick = -1; phaseSound(s); render(s); } else update(s);
  } catch (e) { setNet(false); }
  P.busy = false;
}

function render(s) {
  clean();
  if (!s.me) return renderJoin(s);
  if (s.status === 'lobby') return renderLobby(s);
  if (s.status === 'ended') return renderEnd(s);
  if (!s.question) { app.innerHTML = `<div class="screen">${meBar(s)}<div class="screen mid"><div class="huge-emoji bounce">⏳</div><p class="waitdots">Hetk</p></div></div>`; return; }
  if (s.phase === 'intro') return renderIntro(s);
  if (s.phase === 'question') {
    if (s.my && s.my.answered) return renderSent(s, '');
    return renderQuestion(s);
  }
  if (s.phase === 'reveal') return renderReveal(s);
  if (s.phase === 'board') return renderBoard(s);
}
function phaseSound(s) {
  if (s.status !== 'running') return;
  const sig = s.round + ':' + s.q_index + ':' + s.phase;
  if (P.lastPhaseSound === sig) return;
  P.lastPhaseSound = sig;
  if (s.phase === 'intro') SFX.lobbyPulse();
  else if (s.phase === 'question') SFX.questionStart();
}
function update(s) {
  const c = $('#cnt'); if (c) c.textContent = s.players;
  const sc = $('#myscore'); if (sc && s.me) sc.textContent = fmtNum(s.me.score);
}

// ---------- join ----------
function renderJoin(s) {
  const am = s.allow_mode;
  if (am === 'solo') P.joinType = 'solo'; if (am === 'team') P.joinType = 'team';
  app.innerHTML = `<div class="screen">
    <div class="brand">${MASCOT}<div><h1>${esc(s.title)}</h1><small>Liitu mänguga ja vaata telerit! 📺</small></div></div>
    ${P.kicked ? '<div class="card center" style="padding:12px">👋 Sind eemaldati mängust. Liitu uuesti!</div>' : ''}
    ${s.lock_join ? '<div class="card center"><div class="big-emoji">🔒</div><h2>Liitumine on hetkel suletud</h2><p class="muted">Oota, kuni õpetaja selle avab.</p></div>' : `
    <form class="card" id="jf">
      ${am === 'both' ? `<div class="seg"><button type="button" data-t="solo" class="${P.joinType === 'solo' ? 'on' : ''}"><b>🙋</b>Mängin üksi</button><button type="button" data-t="team" class="${P.joinType === 'team' ? 'on' : ''}"><b>👥</b>Mängime tiimina</button></div>` : `<div class="center pill" style="width:100%;justify-content:center">${am === 'team' ? '👥 Tiimimäng' : '🙋 Üksikmäng'}</div>`}
      <label id="nl">${P.joinType === 'team' ? 'Tiimi nimi' : 'Sinu nimi'}</label>
      <input id="jn" maxlength="24" autocomplete="off" placeholder="${P.joinType === 'team' ? 'nt Kiired Kassid' : 'nt Mari'}" required>
      <div id="mw" style="display:${P.joinType === 'team' ? 'block' : 'none'}"><label>Tiimiliikmed <span class="muted">(valikuline)</span></label><input id="jm" maxlength="150" placeholder="nt Mari, Jüri, Kati"></div>
      <label>Vali tegelane</label>
      <div class="avatars">${AVATARS.map(a => `<button type="button" data-a="${a}" class="${a === P.avatar ? 'on' : ''}">${a}</button>`).join('')}</div>
      <div style="height:14px"></div>
      <button class="btn primary big" style="width:100%">🚀 Liitu mänguga</button>
    </form>`}
    <p class="center muted" style="margin:0">Mängijaid: <b id="cnt">${s.players}</b></p>
  </div>`;
  const f = $('#jf'); if (!f) return;
  $$('.seg button').forEach(b => b.onclick = () => {
    P.joinType = b.dataset.t; $$('.seg button').forEach(x => x.classList.toggle('on', x === b));
    $('#nl').textContent = P.joinType === 'team' ? 'Tiimi nimi' : 'Sinu nimi';
    $('#jn').placeholder = P.joinType === 'team' ? 'nt Kiired Kassid' : 'nt Mari';
    $('#mw').style.display = P.joinType === 'team' ? 'block' : 'none';
  });
  $$('.avatars button').forEach(b => b.onclick = () => { P.avatar = b.dataset.a; $$('.avatars button').forEach(x => x.classList.toggle('on', x === b)); SFX.pop(); });
  f.onsubmit = async e => {
    e.preventDefault();
    const btn = f.querySelector('.btn.primary'); btn.disabled = true;
    try {
      const r = await API.post('join', {name: $('#jn').value, type: P.joinType, members: $('#jm') ? $('#jm').value : '', avatar: P.avatar});
      if (!r.ok) { toast(r.error); btn.disabled = false; return; }
      P.id = r.id; P.token = r.token; P.kicked = false;
      localStorage.setItem('vq_pid', r.id); localStorage.setItem('vq_tok', r.token);
      SFX.join(); P.key = ''; poll();
    } catch (err) { toast('Ühenduse viga, proovi uuesti'); btn.disabled = false; }
  };
}

function renderLobby(s) {
  app.innerHTML = `<div class="screen">${meBar(s)}<div class="screen mid">
    <div class="huge-emoji bounce">${esc(s.me.avatar)}</div>
    <h2 style="margin:0">Oled sees, ${esc(s.me.name)}! 🎉</h2>
    <p class="muted waitdots">Ootame, kuni õpetaja mängu käivitab</p>
    <div class="card" style="padding:14px 20px">👥 Mängijaid kokku: <b id="cnt">${s.players}</b></div>
    <p class="muted">Vaata telerit 📺 – küsimused ilmuvad nii seal kui ka siin.</p>
  </div></div>`;
}

function renderIntro(s) {
  const q = s.question || {}; const m = MODES[q.mode] || MODES.classic;
  app.innerHTML = `<div class="screen">${meBar(s)}<div class="screen mid">
    <div class="pill">Küsimus ${s.q_index + 1} / ${s.q_total}</div>
    <div class="card intro-tips popin" style="width:100%;max-width:420px;text-align:center">
      <div class="huge-emoji wiggle">${m.icon}</div>
      <h2 style="margin:.2em 0;font-size:2rem">${m.name}</h2>
      <p class="muted" style="margin:0;font-size:1rem">${m.hint}</p>
      <div class="intro-tip" id="intro-tip">${esc(introTipText(s))}</div>
    </div>
    <div class="rank-big" id="cd"></div>
  </div></div>`;
  P.lastIntroTip = introTipIndex(s);
}

function renderQuestion(s) {
  const q = s.question; const m = MODES[q.mode];
  app.innerHTML = `<div class="screen">
    <div class="qbar"><div class="me-chip"><span class="pill">${m.icon} ${m.name}</span><span class="pill">${s.q_index + 1}/${s.q_total} · ⭐ <span id="myscore">${fmtNum(s.me.score)}</span></span></div>
    <div class="timer"><div class="timer-fill" id="tfill"></div></div></div>
    ${q.mode !== 'truefalse' ? `<div class="qtext">${esc(q.text)}</div>` : ''}
    <div class="play" id="play"></div></div>`;
  const box = $('#play');
  ({classic: uiClassic, catch: uiCatch, balloon: uiBalloon, truefalse: uiTF, slider: uiSlider, order: uiOrder, type: uiType})[q.mode](box, q, s);
}

async function sendAnswer(ans, label) {
  if (P.answered) return; P.answered = true;
  const s = P.st; const qid = s.question.id;
  renderSent(s, label);
  for (let i = 0; i < 3; i++) {
    try {
      const r = await API.post('answer', {pid: P.id, token: P.token, qid: qid, answer: ans});
      if (!r.ok) toast(r.error);
      return;
    } catch (e) { await new Promise(r => setTimeout(r, 600)); }
  }
  toast('Vastust ei õnnestunud saata 😢');
}

function renderSent(s, label) {
  clean();
  app.innerHTML = `<div class="screen">${meBar(s)}<div class="screen mid">
    <div class="huge-emoji bounce">🤞</div><h2 style="margin:0">Vastus saadetud!</h2>
    ${label !== '' && label != null ? `<div class="card" style="padding:12px 20px">Sinu vastus: <b>${esc(label)}</b></div>` : ''}
    <p class="muted waitdots">Ootame teisi</p><p>Vaata telerit 📺</p></div></div>`;
}

// ---------- answer modes ----------
function uiClassic(box, q) {
  box.innerHTML = `<div class="opts n${q.options.length}">` + q.options.map((o, i) => `<button class="opt" style="--c:${OPT_COLORS[i]}" data-i="${i}"><span class="shape">${OPT_SHAPES[i]}</span><span>${esc(o)}</span></button>`).join('') + '</div>';
  $$('.opt', box).forEach(b => b.onclick = () => { SFX.pop(); sendAnswer(+b.dataset.i, q.options[+b.dataset.i]); });
}

function uiCatch(box, q, s) {
  box.innerHTML = `<div class="catch-area" id="ca"><div class="catch-hint">👆 Liiguta sõrme või hiirt (või ← → klahve) ja püüa õige vastus!</div><div class="basket" id="bk"><span class="ava">${esc(s.me.avatar)}</span><span>🧺</span></div></div>`;
  const area = $('#ca', box), bk = $('#bk', box);
  let W = area.clientWidth, H = area.clientHeight, bx = W / 2, target = W / 2, alive = true, items = [], queue = [], spawnT = 0.3, lastLane = -1, prev = performance.now();
  const keys = {};
  const kd = e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { keys[e.key] = e.type === 'keydown'; e.preventDefault(); } };
  const mv = e => { const r = area.getBoundingClientRect(); target = e.clientX - r.left; };
  area.addEventListener('pointermove', mv); area.addEventListener('pointerdown', mv);
  window.addEventListener('keydown', kd); window.addEventListener('keyup', kd);
  function spawn() {
    if (!queue.length) queue = shuffle(q.options.map((_, i) => i));
    const i = queue.shift();
    const el = document.createElement('div'); el.className = 'drop'; el.style.setProperty('--c', OPT_COLORS[i]);
    el.innerHTML = OPT_SHAPES[i] + ' ' + esc(q.options[i]); area.appendChild(el);
    const w = el.offsetWidth, h = el.offsetHeight, lanes = 3;
    let lane; do { lane = Math.floor(Math.random() * lanes); } while (lane === lastLane && lanes > 1); lastLane = lane;
    const x = clamp((lane + 0.5) * W / lanes - w / 2 + (Math.random() - 0.5) * 30, 4, Math.max(4, W - w - 4));
    items.push({el, i, x, y: -h - 4, w, h, v: H / (4.8 + Math.random() * 0.9)});
  }
  function frame(t) {
    if (!alive) return;
    const dt = Math.min(0.05, (t - prev) / 1000); prev = t;
    W = area.clientWidth; H = area.clientHeight;
    const bw = bk.offsetWidth, bh = bk.offsetHeight;
    if (keys.ArrowLeft) target -= 700 * dt; if (keys.ArrowRight) target += 700 * dt;
    target = clamp(target, bw / 2, W - bw / 2);
    bx += (target - bx) * Math.min(1, dt * 16);
    bk.style.transform = `translateX(${bx - bw / 2}px)`;
    spawnT -= dt; if (spawnT <= 0) { spawn(); spawnT = 1.35; }
    const top = H - bh + 10, L = bx - bw / 2 + 10, R = bx + bw / 2 - 10;
    for (const it of items) {
      it.y += it.v * dt;
      it.el.style.transform = `translate(${it.x}px,${it.y}px)`;
      const bottom = it.y + it.h;
      if (bottom >= top && bottom <= top + 46 && it.x + it.w > L && it.x < R) { caught(it); return; }
      if (it.y > H) { it.el.remove(); it.dead = true; }
    }
    items = items.filter(it => !it.dead);
    requestAnimationFrame(frame);
  }
  function caught(it) {
    alive = false; it.el.classList.add('caught'); it.el.style.transform = `translate(${bx - it.w / 2}px,${H - 60}px) scale(.4)`;
    bk.classList.add('happy'); SFX.pop();
    setTimeout(() => sendAnswer(it.i, q.options[it.i]), 380);
  }
  requestAnimationFrame(frame);
  P.cleanup = () => { alive = false; window.removeEventListener('keydown', kd); window.removeEventListener('keyup', kd); };
}

function uiBalloon(box, q) {
  box.innerHTML = `<div class="balloon-area" id="ba"><div class="catch-hint">🎈 Puuduta õige vastusega õhupalli!</div></div>`;
  const area = $('#ba', box);
  let alive = true, items = [], queue = [], spawnT = 0.2, lastLane = -1, prev = performance.now();
  function spawn() {
    const W = area.clientWidth, H = area.clientHeight;
    if (!queue.length) queue = shuffle(q.options.map((_, i) => i));
    const i = queue.shift();
    const el = document.createElement('div'); el.className = 'balloon'; el.style.setProperty('--c', OPT_COLORS[i]);
    el.innerHTML = `<div class="bl-body"><span>${esc(q.options[i])}</span></div><div class="bl-string"></div>`;
    area.appendChild(el);
    const lanes = Math.max(2, Math.min(4, Math.floor(W / 130)));
    let lane; do { lane = Math.floor(Math.random() * lanes); } while (lane === lastLane); lastLane = lane;
    const x = clamp((lane + 0.5) * W / lanes - 59, 2, W - 120);
    const it = {el, i, x, y: H + 10, v: H / (4.6 + Math.random() * 1.4), ph: Math.random() * 6};
    el.addEventListener('pointerdown', e => { e.preventDefault(); pop(it); });
    items.push(it);
  }
  function frame(t) {
    if (!alive) return;
    const dt = Math.min(0.05, (t - prev) / 1000); prev = t;
    spawnT -= dt; if (spawnT <= 0) { spawn(); spawnT = 0.95; }
    for (const it of items) {
      it.y -= it.v * dt;
      it.el.style.transform = `translate(${it.x + Math.sin(t / 650 + it.ph) * 14}px,${it.y}px) rotate(${Math.sin(t / 800 + it.ph) * 5}deg)`;
      if (it.y < -200) { it.el.remove(); it.dead = true; }
    }
    items = items.filter(it => !it.dead);
    requestAnimationFrame(frame);
  }
  function pop(it) {
    if (!alive) return; alive = false;
    it.el.classList.add('popped'); SFX.pop();
    setTimeout(() => sendAnswer(it.i, q.options[it.i]), 420);
  }
  requestAnimationFrame(frame);
  P.cleanup = () => { alive = false; };
}

function uiTF(box, q) {
  box.innerHTML = `<div class="tf-simple">
    <div class="tf-qtext">${esc(q.text)}</div>
    <div class="tf-btns tf-btns-full"><button class="btn big red" data-v="0">❌ Vale</button><button class="btn big green" data-v="1">✅ Õige</button></div>
  </div>`;
  let done = false;
  function choose(v) {
    if (done) return; done = true;
    SFX.pop(); sendAnswer(v, v ? 'Õige ✅' : 'Vale ❌');
  }
  $$('.tf-btns .btn', box).forEach(b => b.onclick = () => choose(+b.dataset.v));
}

function uiSlider(box, q) {
  const e = q.extra, st = +e.step || 1, dec = (String(st).split('.')[1] || '').length;
  const snap = v => clamp(Math.round((v - e.min) / st) * st + +e.min, +e.min, +e.max);
  let val = snap((+e.min + +e.max) / 2);
  box.innerHTML = `<div class="slider-box"><div class="slider-val"><span id="sv"></span> <small>${esc(e.unit || '')}</small></div>
    <input type="range" id="sr" min="${e.min}" max="${e.max}" step="${st}" value="${val}">
    <div class="slider-minmax"><span>${fmtNum(e.min)}</span><span>${fmtNum(e.max)}</span></div>
    <div class="row c"><button class="btn big" data-d="-1">➖</button><button class="btn big" data-d="1">➕</button></div>
    <button class="btn big primary" id="ss">Saada vastus 🚀</button></div>`;
  const sv = $('#sv', box), sr = $('#sr', box);
  const show = () => { sv.textContent = Number(val).toLocaleString('et-EE', {minimumFractionDigits: dec, maximumFractionDigits: dec}); };
  show();
  sr.oninput = () => { val = snap(+sr.value); show(); };
  $$('[data-d]', box).forEach(b => b.onclick = () => { val = snap(val + st * +b.dataset.d); sr.value = val; show(); SFX.tick(); });
  $('#ss', box).onclick = () => { SFX.pop(); sendAnswer(val, sv.textContent + (e.unit ? ' ' + e.unit : '')); };
}

function uiOrder(box, q) {
  let seq = [];
  box.innerHTML = `<p class="center muted" style="margin:0">Puuduta õiges järjekorras (1, 2, 3…)</p><div class="order-list">` + q.items.map((it, k) => `<button class="opt order-it" style="--c:${OPT_COLORS[k]}" data-i="${it.i}"><span class="num"></span><span>${esc(it.t)}</span></button>`).join('') +
    `</div><div class="tf-btns"><button class="btn big" id="oc">↺ Otsast</button><button class="btn big primary" id="os" disabled>Saada 🚀</button></div>`;
  const btns = $$('.order-it', box), send = $('#os', box);
  const paint = () => { btns.forEach(b => { const p = seq.indexOf(+b.dataset.i); b.classList.toggle('sel', p >= 0); $('.num', b).textContent = p >= 0 ? p + 1 : ''; }); send.disabled = seq.length !== btns.length; };
  btns.forEach(b => b.onclick = () => { const i = +b.dataset.i, p = seq.indexOf(i); if (p >= 0) seq = seq.slice(0, p); else seq.push(i); SFX.tick(); paint(); });
  $('#oc', box).onclick = () => { seq = []; paint(); };
  send.onclick = () => { SFX.pop(); sendAnswer(seq, seq.map(i => q.items.find(x => x.i === i).t).join(' → ')); };
}

function uiType(box, q) {
  box.innerHTML = `<form class="type-box" id="tf"><div class="center big-emoji">✍️</div><input id="ti" maxlength="60" autocomplete="off" autocapitalize="off" placeholder="Kirjuta vastus siia…"><button class="btn big primary">Saada 🚀</button></form>`;
  const ti = $('#ti', box); setTimeout(() => ti.focus(), 100);
  $('#tf', box).onsubmit = e => { e.preventDefault(); const v = ti.value.trim(); if (!v) { ti.classList.add('shake'); setTimeout(() => ti.classList.remove('shake'), 500); return; } SFX.pop(); sendAnswer(v, v); };
}

// ---------- results ----------
function renderReveal(s) {
  const my = s.my || {answered: false}; const q = s.question;
  let cls = 'none', head = '⏰ Aeg sai otsa!', emo = '🙈';
  if (my.answered && my.correct) { cls = 'good'; head = 'Õige vastus!'; emo = '🎉'; }
  else if (my.answered) { cls = 'bad'; head = my.points > 0 ? 'Peaaegu!' : 'Oih, vale!'; emo = my.points > 0 ? '😅' : '🙈'; }
  app.innerHTML = `<div class="screen">${meBar(s)}<div class="screen mid">
    <div class="result ${cls} popin" style="width:100%"><div class="huge-emoji">${emo}</div><h2>${head}</h2>
      ${my.answered ? `<div class="pts">+${fmtNum(my.points || 0)}</div>` : ''}
      ${my.correct && s.me.streak > 1 ? `<div class="streak">🔥 ${s.me.streak} järjest õigesti!</div>` : ''}</div>
    <div class="card" style="width:100%"><div class="muted">Õige vastus</div><div style="font-size:1.4rem;font-weight:700">${esc(answerText(q))}</div></div>
    <div class="pill">🏅 Sinu koht: ${s.me.rank}.</div></div></div>`;
  if (my.answered && my.correct) { SFX.correct(); confetti(30); } else if (my.answered) SFX.wrong();
}

function renderBoard(s) {
  app.innerHTML = `<div class="screen">${meBar(s)}<div class="screen mid">
    <div class="big-emoji bounce">🏆</div><h2 style="margin:0">Vahetabel</h2>
    <div class="rank-big">${s.me.rank}.</div><div class="muted">koht · ${fmtNum(s.me.score)} punkti</div>
    <p>Vaata telerist edetabelit 📺</p></div></div>`;
}

function renderEnd(s) {
  const r = s.me.rank;
  const medal = r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : '🎈';
  app.innerHTML = `<div class="screen">${meBar(s)}<div class="screen mid">
    <div class="huge-emoji bounce">${medal}</div><h2 style="margin:0">Mäng läbi!</h2>
    <div class="rank-big">${r}.</div><div class="muted">koht · <b>${fmtNum(s.me.score)}</b> punkti · ${s.me.correct} õiget</div>
    <div class="mini-board">${(s.board || []).map((p, i) => `<div><span>${['🥇', '🥈', '🥉'][i]} ${esc(p.avatar)} ${esc(p.name)}</span><span>${fmtNum(p.score)}</span></div>`).join('')}</div>
    <p class="muted">Aitäh mängimast! 💖</p></div></div>`;
  if (r <= 3) { confetti(80); SFX.fanfare(); }
}

// timers
setInterval(() => {
  const s = P.st; if (!s || s.status !== 'running') return;
  const left = s.phase_ends - Clock.now();
  const tf = $('#tfill');
  if (tf && s.phase === 'question') {
    const tot = Math.max(1, s.phase_ends - s.phase_started);
    tf.style.width = clamp(left / tot * 100, 0, 100) + '%';
    const sec = Math.ceil(left);
    if (sec <= 5 && sec > 0 && sec !== P.lastTick && !P.answered) { P.lastTick = sec; SFX.countdown(sec); }
  }
  const cd = $('#cd'); if (cd) cd.textContent = Math.max(1, Math.ceil(left));
  if (s.phase === 'intro') {
    const tip = $('#intro-tip');
    if (tip) {
      const idx = introTipIndex(s);
      if (idx !== P.lastIntroTip) {
        P.lastIntroTip = idx;
        tip.classList.remove('intro-tip-in');
        void tip.offsetWidth;
        tip.textContent = introTipText(s);
        tip.classList.add('intro-tip-in');
      }
    }
  }
}, 120);
setInterval(poll, 1000); poll();
