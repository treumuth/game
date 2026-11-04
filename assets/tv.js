'use strict';
const T = {st: null, key: '', busy: false, ranks: {}, seen: {}, lastTick: -1, lastIntroTip: -1, lastPhaseSound: '', fallTimer: null};
const stage = $('#stage');
bubbles(16);

$('#gate-go').onclick = () => { SFX.init(); SFX.on = true; $('#gate').remove(); fs(true); };
$('#gate-mute').onclick = () => { SFX.on = false; $('#btn-sound').textContent = '🔇'; $('#gate').remove(); };
$('#btn-sound').onclick = () => { SFX.init(); SFX.on = !SFX.on; $('#btn-sound').textContent = SFX.on ? '🔊' : '🔇'; };
$('#btn-fs').onclick = () => fs(!document.fullscreenElement);
function fs(on) { try { if (on) document.documentElement.requestFullscreen(); else document.exitFullscreen(); } catch (e) {} }
let idle; document.addEventListener('mousemove', () => { document.body.classList.remove('hidecursor'); clearTimeout(idle); idle = setTimeout(() => document.body.classList.add('hidecursor'), 3000); });

function joinUrl(s) {
  if (s.join_url) return s.join_url;
  return location.href.replace(/[#?].*$/, '').replace(/tv\.php$/, '');
}
function viewKey(s) {
  if (s.status !== 'running') return s.status + ':' + s.round;
  return 'run:' + s.round + ':' + s.q_index + ':' + s.phase;
}

async function poll() {
  if (T.busy) return; T.busy = true;
  try {
    const s = await API.get('state', {role: 'tv'});
    if (!s.ok) throw new Error(s.error);
    $('#net').classList.remove('show');
    T.st = s; header(s);
    applyTheme(s);
    const k = viewKey(s);
    if (k !== T.key) { T.key = k; T.lastIntroTip = -1; T.lastTick = -1; phaseSound(s); render(s); } else update(s);
  } catch (e) { $('#net').classList.add('show'); }
  T.busy = false;
}

function header(s) {
  $('#tv-title').textContent = s.title;
  const lab = {lobby: '🟡 Ootesaal', running: '🟢 Mäng käib', ended: '🏁 Mäng läbi'}[s.status] || s.status;
  $('#tv-status').textContent = lab + (s.status === 'running' ? ` · ${s.q_index + 1}/${s.q_total}` : '');
  $('#tv-count').textContent = '👥 ' + s.players;
}

function phaseSound(s) {
  if (s.status !== 'running') return;
  const sig = s.round + ':' + s.q_index + ':' + s.phase;
  if (T.lastPhaseSound === sig) return;
  T.lastPhaseSound = sig;
  if (s.phase === 'intro') SFX.lobbyPulse();
  else if (s.phase === 'question') SFX.questionStart();
}
function stopFall() { if (T.fallTimer) { clearInterval(T.fallTimer); T.fallTimer = null; } }
function render(s) {
  stopFall();
  if (s.status === 'lobby') return renderLobby(s);
  if (s.status === 'ended') return renderEnd(s);
  if (!s.question) { stage.innerHTML = '<div class="intro"><div class="mode-ico bounce">⏳</div></div>'; return; }
  if (s.phase === 'intro') return renderIntro(s);
  if (s.phase === 'question' || s.phase === 'reveal') return renderQ(s, s.phase === 'reveal');
  if (s.phase === 'board') return renderBoard(s, s.board || [], '🏆 Edetabel');
}
function update(s) {
  if (s.status === 'lobby') return updatePeople(s);
  const a = $('#ans'); if (a) a.textContent = `✋ ${s.answered || 0} / ${s.online || s.players}`;
}

function renderLobby(s) {
  const url = joinUrl(s);
  stage.innerHTML = `<div class="lobby">
    <div class="card join-card">
      <h2>Liitu mänguga! 📱</h2>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=10&data=${encodeURIComponent(url)}" alt="QR" onerror="this.style.display='none'">
      <div class="url">${esc(url.replace(/^https?:\/\//, ''))}</div>
      <div class="muted" style="font-size:1.3vw">Skanni QR-kood või ava aadress telefonis<br>🙋 üksi või 👥 tiimina</div>
    </div>
    <div class="card people"><h2>Mängijad (<span id="pc">0</span>) <span class="muted" style="font-size:1.3vw">· ootame, kuni õpetaja mängu käivitab…</span></h2><div class="people-cloud" id="cloud"></div></div>
  </div>`;
  T.seen = {}; updatePeople(s, true);
}
function updatePeople(s, first) {
  const cloud = $('#cloud'); if (!cloud) return;
  const list = (s.people || []).slice().reverse();
  $('#pc').textContent = s.players;
  const ids = {};
  list.forEach(p => {
    ids[p.id] = 1;
    if (T.seen[p.id]) return;
    T.seen[p.id] = 1;
    const el = document.createElement('div'); el.className = 'person'; el.dataset.id = p.id;
    el.innerHTML = `<span class="a">${esc(p.avatar)}</span>${esc(p.name)}${p.type === 'team' ? '<span class="t">tiim</span>' : ''}`;
    cloud.appendChild(el); if (!first) SFX.join();
  });
  $$('.person', cloud).forEach(el => { if (!ids[el.dataset.id]) { el.remove(); delete T.seen[el.dataset.id]; } });
  if (!list.length && !$('.empty-hint', cloud)) cloud.innerHTML = '<div class="empty-hint">Keegi pole veel liitunud… ole esimene! 🐣</div>';
  if (list.length) { const h = $('.empty-hint', cloud); if (h) h.remove(); }
}

function renderIntro(s) {
  const q = s.question || {}; const m = MODES[q.mode] || MODES.classic;
  stage.innerHTML = `<div class="intro">
    <div class="qn">${s.q_index === 0 ? '🎬 Mäng algab! · ' : ''}Küsimus ${s.q_index + 1} / ${s.q_total}</div>
    <div class="mode-card popin"><div class="mode-ico wiggle">${m.icon}</div><div class="mode-name">${m.name}</div><div class="mode-hint">${m.hint}</div>
    <div class="intro-tip tv-intro-tip" id="intro-tip">${esc(introTipText(s))}</div></div>
    <div class="cd" id="cd"></div></div>`;
  T.lastIntroTip = introTipIndex(s);
}

function ring() {
  return `<div class="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#fff" stroke="#eee6ff" stroke-width="10"/><circle id="rc" cx="50" cy="50" r="44" fill="none" stroke="#ff6b9d" stroke-width="10" stroke-linecap="round" stroke-dasharray="276.5" stroke-dashoffset="0"/></svg><div class="num" id="rn"></div></div>`;
}

function renderQ(s, rev) {
  const q = s.question; const st = s.stats || {}; const m = q.mode;
  let body = '';
  if (m === 'classic' || m === 'catch' || m === 'balloon') {
    const tot = Math.max(1, st.total || 0);
    body = `<div class="tv-opts">` + q.options.map((o, i) => {
      const c = st.counts ? st.counts[i] : 0;
      const cls = rev ? (i === q.answer ? 'win' : 'dim') : '';
      return `<div class="tv-opt ${cls}" style="--c:${OPT_COLORS[i]}"><span class="shape">${OPT_SHAPES[i]}</span><span>${esc(o)}</span>${rev ? `<span class="cnt">${c}</span><div class="bar" style="width:${c / tot * 100}%"></div>` : ''}</div>`;
    }).join('') + '</div>';
  } else if (m === 'truefalse') {
    const c = st.counts || [0, 0], tot = Math.max(1, st.total || 0);
    body = `<div class="tv-tf-q">${esc(q.text)}</div><div class="tv-opts tv-opts-tf">` + [[1, '✅ Õige', '#4cc764'], [0, '❌ Vale', '#f25c5c']].map(([v, l, col]) =>
      `<div class="tv-opt ${rev ? (v === q.answer ? 'win' : 'dim') : ''}" style="--c:${col};justify-content:center;font-size:5vw;min-height:18vh">${l}${rev ? `<span class="cnt">${c[v]}</span><div class="bar" style="width:${c[v] / tot * 100}%"></div>` : ''}</div>`).join('') + '</div>';
  } else if (m === 'slider') {
    const e = q.extra;
    body = rev ? `<div class="tv-big popin"><div class="s">Õige vastus</div><div class="v">${fmtNum(q.answer)} <span style="font-size:3vw">${esc(e.unit || '')}</span></div><div class="s">Klassi keskmine pakkumine: <b>${st.avg != null ? fmtNum(st.avg) : '–'}</b> · Täpselt pihta: <b>${st.correct || 0}</b></div></div>`
      : `<div class="tv-big"><div style="font-size:6vw">🎚️</div><div>Paku number oma seadmes!</div><div class="v" style="font-size:4vw">${fmtNum(e.min)} … ${fmtNum(e.max)} <span style="font-size:2vw">${esc(e.unit || '')}</span></div></div>`;
  } else if (m === 'order') {
    const list = rev ? q.correct_order.map((t, i) => ({i, t})) : q.items;
    body = `<div class="tv-opts order">` + list.map((it, k) => `<div class="tv-opt ${rev ? 'win' : ''}" style="--c:${OPT_COLORS[rev ? it.i : k]};font-size:2.2vw;padding:.6vw 2vw;animation-delay:${k * 0.15}s"><span class="shape">${rev ? (k + 1) + '.' : OPT_SHAPES[k]}</span><span>${esc(it.t)}</span></div>`).join('') + '</div>' +
      (rev ? `<div class="answered" style="align-self:center">🎯 Täiesti õigesti: ${st.correct || 0} / ${st.total || 0}</div>` : '');
  } else if (m === 'type') {
    body = rev ? `<div class="tv-big popin"><div class="s">Õige vastus</div><div class="v" style="font-size:6vw">${esc((q.answer || [])[0] || '')}</div><div class="s">Õigesti vastas <b>${st.correct || 0}</b> / ${st.total || 0}</div></div>`
      : `<div class="tv-big"><div style="font-size:7vw" class="bounce">⌨️</div><div>Kirjuta vastus oma seadmes!</div></div>`;
  }
  const hideQtxt = m === 'truefalse';
  stage.innerHTML = `<div class="tvq">${hideQtxt ? '<div class="qtxt qtxt-spacer"></div>' : `<div class="qtxt">${esc(q.text)}</div>`}<div class="tvq-side">${rev ? '<div style="font-size:6vw">🎉</div>' : ring()}<div class="answered" id="ans">✋ ${s.answered || 0} / ${s.online || s.players}</div></div></div>
    <div class="tv-body" style="position:relative">${q.image ? `<img class="tv-img" src="${esc(q.image)}" alt="">` : ''}${body}</div>`;
  if (!rev && (m === 'catch' || m === 'balloon')) startFall(m === 'catch' ? ['⭐', '🍓', '🍋', '🫐', '🍀'] : ['🎈', '🎈', '🎈', '💖']);
  if (rev) SFX.reveal();
}
function startFall(em) {
  const host = $('.tv-body'); if (!host) return;
  const isCatch = em[0] !== '🎈';
  T.fallTimer = setInterval(() => {
    const e = document.createElement('div'); e.className = 'tv-fall'; e.textContent = em[Math.floor(Math.random() * em.length)];
    e.style.left = Math.random() * 95 + '%';
    e.style.animationDuration = (isCatch ? 4.2 + Math.random() * 3.5 : 3 + Math.random() * 3) + 's';
    if (!isCatch) { e.style.top = 'auto'; e.style.bottom = '-6vw'; e.style.animationName = 'rise'; }
    host.appendChild(e); setTimeout(() => e.remove(), isCatch ? 8200 : 6500);
  }, isCatch ? 520 : 450);
}

function renderBoard(s, list, title) {
  const newRanks = {};
  stage.innerHTML = `<div class="board"><h2>${title}</h2>` + (list.length ? list.map((p, i) => {
    newRanks[p.id] = i + 1;
    const old = T.ranks[p.id]; let mv = '';
    if (old && old > i + 1) mv = `<span class="mv up">▲${old - i - 1}</span>`; else if (old && old < i + 1) mv = `<span class="mv down">▼${i + 1 - old}</span>`; else mv = '<span class="mv"></span>';
    return `<div class="brow" style="animation-delay:${i * 0.07}s"><span class="rk">${i + 1}.</span>${mv}<span class="a">${esc(p.avatar)}</span><span class="nm">${esc(p.name)}${p.type === 'team' ? '<small>👥 ' + esc(p.members || 'tiim') + '</small>' : ''}${p.streak > 1 ? ' <small>🔥' + p.streak + '</small>' : ''}</span><span class="sc">${fmtNum(p.score)}</span></div>`;
  }).join('') : '<div class="tv-big">Edetabel on tühi 🐣</div>') + '</div>';
  T.ranks = Object.assign(T.ranks, newRanks);
  SFX.whoosh();
}

function renderEnd(s) {
  const b = s.board || [];
  const pod = (p, n) => p ? `<div class="pod p${n}"><div class="a">${esc(p.avatar)}</div><div class="nm">${esc(p.name)}</div><div class="sc">${fmtNum(p.score)} p</div><div class="blk">${n}</div></div>` : `<div class="pod p${n}" style="opacity:.25"><div class="a">❔</div><div class="nm">–</div><div class="sc">&nbsp;</div><div class="blk">${n}</div></div>`;
  stage.innerHTML = `<div class="board"><h2>🏁 Mäng läbi! Võitjad:</h2>
    <div class="podium">${pod(b[1], 2)}${pod(b[0], 1)}${pod(b[2], 3)}</div>
    <div class="rest">${b.slice(3).map((p, i) => `<div class="person"><b>${i + 4}.</b> <span class="a">${esc(p.avatar)}</span>${esc(p.name)} · ${fmtNum(p.score)}</div>`).join('')}</div></div>`;
  if (b.length && s.round > 0) { confetti(120); SFX.fanfare(); }
}

setInterval(() => {
  const s = T.st; if (!s || s.status !== 'running') return;
  const left = s.phase_ends - Clock.now();
  const cd = $('#cd'); if (cd) cd.textContent = Math.max(1, Math.ceil(left));
  const rc = $('#rc'), rn = $('#rn');
  if (rc && s.phase === 'question') {
    const tot = Math.max(1, s.phase_ends - s.phase_started), f = clamp(left / tot, 0, 1);
    rc.setAttribute('stroke-dashoffset', String(276.5 * (1 - f)));
    rc.setAttribute('stroke', f > 0.5 ? '#4cc764' : f > 0.25 ? '#ffb02e' : '#ff4f6d');
    const sec = Math.max(0, Math.ceil(left)); rn.textContent = sec;
    if (sec <= 5 && sec > 0 && sec !== T.lastTick) { T.lastTick = sec; SFX.countdown(sec); }
  }
  if (s.phase === 'intro') {
    const tip = $('#intro-tip');
    if (tip) {
      const idx = introTipIndex(s);
      if (idx !== T.lastIntroTip) {
        T.lastIntroTip = idx;
        tip.classList.remove('intro-tip-in');
        void tip.offsetWidth;
        tip.textContent = introTipText(s);
        tip.classList.add('intro-tip-in');
      }
    }
  }
}, 100);
setInterval(poll, 1000); poll();
