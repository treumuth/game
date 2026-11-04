'use strict';
const MODES = {
  classic:  {name: 'Klassika', icon: '🎯', hint: 'Vali õige vastus!',
    tips: ['Puuduta värvilist nuppu, mis tundub õige.', 'Kiire vastus annab rohkem punkte.', 'Vaata telerit — seal on suur küsimus.']},
  catch:    {name: 'Püüdmine', icon: '🧺', hint: 'Liiguta korvi ja püüa õige vastus kinni!',
    tips: ['Liiguta sõrme, hiirt või kasuta ← → klahve.', 'Püüa kinni õige vastus — vale tabamine loeb valeks.', 'Sul on rohkem aega kui teistes režiimides.']},
  balloon:  {name: 'Õhupallid', icon: '🎈', hint: 'Löö lõhki õige vastusega õhupall!',
    tips: ['Puuduta õige tekstiga õhupalli.', 'Õhupallid liiguvad — oota hetk ja siis löö.', 'Vale pall = vale vastus.']},
  truefalse:{name: 'Õige või vale', icon: '👍', hint: 'Vajuta suurt rohelist või punast nuppu!',
    tips: ['Roheline = väide on õige, punane = vale.', 'Loe väide rahulikult läbi enne vajutamist.', 'Kiire vastus toob rohkem punkte.']},
  slider:   {name: 'Arvamismäng', icon: '🎚️', hint: 'Liiguta liugurit ja paku number!',
    tips: ['Liiguta liugurit või kasuta ➕ / ➖.', 'Vajuta „Saada vastus“, kui oled valmis.', 'Lähedased arvud saavad osa punkte.']},
  order:    {name: 'Järjestamine', icon: '🔢', hint: 'Puuduta vastuseid õiges järjekorras!',
    tips: ['Puuduta esimest, siis teist jne.', 'Vale järjekord? Puuduta uuesti algusest.', 'Kui valmis, vajuta „Saada“.']},
  type:     {name: 'Kirjuta ise', icon: '⌨️', hint: 'Kirjuta vastus oma seadmes!',
    tips: ['Kirjuta lühike vastus ja vajuta saada.', 'Suur- ja väiketähed ei loe.', 'Täpitähed normaliseeritakse automaatselt.']}
};
const VQ_THEMES = ['default', 'dark', 'neon', 'school'];

function modeTips(mode) {
  const m = MODES[mode] || MODES.classic;
  return m.tips && m.tips.length ? m.tips : [m.hint];
}
function introTipIndex(s) {
  const q = s.question || {};
  const tips = modeTips(q.mode || 'classic');
  const elapsed = Math.max(0, Clock.now() - s.phase_started);
  return Math.floor(elapsed / 1.5) % tips.length;
}
function introTipText(s) {
  const tips = modeTips((s.question || {}).mode || 'classic');
  return tips[introTipIndex(s)];
}

const Theme = {applied: '', css: ''};
function applyTheme(s) {
  if (!s) return;
  const theme = VQ_THEMES.includes(s.theme) ? s.theme : 'default';
  const css = s.custom_css != null ? String(s.custom_css) : '';
  document.body.classList.forEach(c => { if (c.startsWith('theme-')) document.body.classList.remove(c); });
  document.body.classList.add('theme-' + theme);
  if (Theme.applied !== theme || Theme.css !== css) {
    Theme.applied = theme; Theme.css = css;
    let el = document.getElementById('vq-custom');
    if (!el) { el = document.createElement('style'); el.id = 'vq-custom'; document.head.appendChild(el); }
    el.textContent = css;
  }
}
const OPT_COLORS = ['#ff6b9d', '#ffb02e', '#38bdf8', '#4cc764', '#a77bff', '#ff7a59'];
const OPT_SHAPES = ['🍓', '🍋', '🫐', '🍀', '🍇', '🍊'];
const AVATARS = ['🐱','🐶','🐼','🦊','🐸','🐵','🐰','🐻','🐨','🐯','🦄','🐙','🐧','🐥','🦖','🐳','🐹','🦁','🐮','🐷','🐲','🦉','🐝','🦋'];

const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmtNum = n => Number(n).toLocaleString('et-EE');

const Clock = {
  offset: 0, best: 1e9,
  sync(serverSec, t0, t1) {
    const rtt = t1 - t0;
    this.best += 20;
    if (rtt <= this.best) { this.best = rtt; this.offset = serverSec * 1000 - (t0 + rtt / 2); }
  },
  now() { return (Date.now() + this.offset) / 1000; }
};

const API = {
  async req(action, params, body) {
    let url = 'api.php?action=' + encodeURIComponent(action);
    if (params) for (const k in params) url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    const opts = {method: body ? 'POST' : 'GET', headers: {}, cache: 'no-store', credentials: 'same-origin'};
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    if (window.CSRF) opts.headers['X-CSRF'] = window.CSRF;
    const t0 = Date.now();
    const r = await fetch(url, opts);
    const txt = await r.text();
    let j;
    try { j = JSON.parse(txt); } catch (e) { throw new Error('Serveri viga: ' + txt.slice(0, 160)); }
    if (j && j.now) Clock.sync(j.now, t0, Date.now());
    return j;
  },
  get(action, params) { return this.req(action, params, null); },
  post(action, body) { return this.req(action, null, body || {}); }
};

const SFX = {
  ctx: null, on: true,
  init() {
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {}
  },
  tone(f, d, type, vol, delay) {
    if (!this.on || !this.ctx) return;
    try {
      const t = this.ctx.currentTime + (delay || 0), o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + d + 0.05);
    } catch (e) {}
  },
  tick() { this.countdown(1); },
  countdown(sec) {
    const s = Math.max(1, Math.min(5, sec | 0));
    const f = s <= 2 ? 1047 : s <= 3 ? 880 : 660;
    const d = s <= 2 ? 0.09 : 0.07;
    const v = s <= 2 ? 0.06 : 0.04;
    this.tone(f, d, 'square', v);
    if (s <= 2) this.tone(f * 1.25, d * 0.7, 'sine', v * 0.6, 0.04);
  },
  pop() { this.tone(520, 0.08, 'triangle', 0.22); this.tone(1100, 0.07, 'sine', 0.12, 0.03); },
  join() { this.tone(988, 0.1, 'sine', 0.12); this.tone(1319, 0.16, 'sine', 0.12, 0.08); },
  good() { this.correct(); },
  bad() { this.wrong(); },
  correct() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.14, i * 0.07)); },
  wrong() { this.tone(196, 0.28, 'sawtooth', 0.06); this.tone(147, 0.35, 'triangle', 0.05, 0.12); },
  whoosh() { [300, 450, 600, 800].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.08, i * 0.04)); },
  lobbyPulse() { this.tone(440, 0.1, 'sine', 0.1); this.tone(554, 0.14, 'sine', 0.1, 0.06); },
  questionStart() { this.tone(392, 0.08, 'sine', 0.1); this.tone(784, 0.12, 'triangle', 0.12, 0.06); this.tone(988, 0.1, 'sine', 0.08, 0.14); },
  reveal() { this.tone(660, 0.12, 'triangle', 0.15); this.tone(990, 0.25, 'triangle', 0.15, 0.1); },
  fanfare() { [523, 523, 523, 698, 880, 784, 1047].forEach((f, i) => this.tone(f, i === 6 ? 0.6 : 0.16, 'triangle', 0.16, [0, .15, .3, .45, .75, 1.0, 1.2][i])); }
};
document.addEventListener('pointerdown', () => SFX.init());
document.addEventListener('keydown', () => SFX.init());

function confetti(n) {
  const box = document.createElement('div'); box.className = 'confetti';
  const em = ['🎉', '✨', '⭐', '💖', '🎊', '🌟', '🍬', '🎈'];
  for (let i = 0; i < (n || 70); i++) {
    const s = document.createElement('span'); s.textContent = em[i % em.length];
    s.style.left = (Math.random() * 100) + 'vw'; s.style.fontSize = (16 + Math.random() * 30) + 'px';
    s.style.animationDuration = (2.6 + Math.random() * 2.6) + 's'; s.style.animationDelay = (Math.random() * 1.6) + 's';
    box.appendChild(s);
  }
  document.body.appendChild(box); setTimeout(() => box.remove(), 7500);
}

function toast(msg, ms) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), ms || 2600);
}

function bubbles(n) {
  const b = $('.bg-bubbles'); if (!b) return;
  for (let i = 0; i < (n || 14); i++) {
    const s = document.createElement('i'), size = 20 + Math.random() * 90;
    s.style.width = s.style.height = size + 'px'; s.style.left = (Math.random() * 100) + '%';
    s.style.animationDuration = (14 + Math.random() * 18) + 's'; s.style.animationDelay = (-Math.random() * 30) + 's';
    b.appendChild(s);
  }
}

function answerText(q) {
  if (!q || q.answer === undefined) return '';
  switch (q.mode) {
    case 'classic': case 'catch': case 'balloon': return q.options[q.answer];
    case 'truefalse': return q.answer ? 'Õige ✅' : 'Vale ❌';
    case 'slider': return fmtNum(q.answer) + (q.extra && q.extra.unit ? ' ' + q.extra.unit : '');
    case 'order': return (q.correct_order || []).join(' → ');
    case 'type': return (q.answer || []).join(' / ');
  }
  return '';
}
const MASCOT = '<div class="mascot"><i class="eye l"></i><i class="eye r"></i><i class="blush l"></i><i class="blush r"></i><i class="mouth"></i></div>';
