'use strict';
const A = {st: null, qHash: '', pHash: '', settingsLoaded: false};
const PHASES = {intro: '🎬 Tutvustus', question: '⏱️ Küsimus käib', reveal: '✅ Õige vastus', board: '🏆 Vahetabel'};

$$('.tabs button').forEach(b => b.onclick = () => {
  $$('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  $$('.tab').forEach(t => t.classList.toggle('on', t.id === 'tab-' + b.dataset.tab));
});

async function call(action, body) {
  const r = await API.post(action, body || {});
  if (!r.ok) { if (r.auth === false) { location.reload(); } toast('⚠️ ' + r.error, 3500); throw new Error(r.error); }
  return r;
}
async function act(action, body, msg) { try { await call(action, body); if (msg) toast(msg); await load(); } catch (e) {} }

// ---------- game tab ----------
$('#tab-game').innerHTML = `<div class="grid2">
  <div class="card">
    <div class="status-big"><span class="status-dot" id="g-dot"></span><span id="g-status">…</span></div>
    <div class="kv">
      <span>Faas:</span><b id="g-phase">–</b>
      <span>Küsimus:</span><b id="g-q">–</b>
      <span>Vastanud:</span><b id="g-ans">–</b>
      <span>Aega jäänud:</span><b id="g-left">–</b>
      <span>Mängijad:</span><b id="g-pl">–</b>
    </div>
    <div class="ctrl">
      <button class="btn green big" id="b-start">▶️ Käivita mäng</button>
      <button class="btn yellow big" id="b-next">⏭ Järgmine samm</button>
      <button class="btn red big" id="b-end">⏹ Lõpeta mäng</button>
      <button class="btn big" id="b-lobby">🔄 Tagasi ootesaali</button>
    </div>
    <p class="help">Mäng liigub ise edasi (tutvustus → küsimus → õige vastus → edetabel). „Järgmine samm“ jätab ootamise vahele. Kui kõik on vastanud, avaldatakse vastus kohe.</p>
  </div>
  <div class="card">
    <h3 style="margin-top:0">📺 Kuidas mängida?</h3>
    <ol style="line-height:1.6;padding-left:20px;margin:0">
      <li>Ava <a href="tv.php" target="_blank"><b>teleriekraan</b></a> suurel ekraanil (klõpsa „Alusta“, et lubada helid).</li>
      <li>Õpilased avavad telefonis mängija lehe (QR-kood on teleris) ja liituvad <b>üksi</b> või <b>tiimina</b>.</li>
      <li>Vajuta <b>„Käivita mäng“</b>. Küsimused ilmuvad telerisse ja telefonidesse.</li>
      <li>Vastamise viisid: 🎯 klassika, 🧺 püüdmine, 🎈 õhupallid, 👍 õige/vale lükkamine, 🎚️ arvamine, 🔢 järjestamine, ⌨️ kirjutamine.</li>
      <li>Kiirem õige vastus = rohkem punkte, 🔥 järjestikused õiged annavad boonust.</li>
    </ol>
    <div id="g-stats" style="margin-top:12px"></div>
  </div>
</div>`;
$('#b-start').onclick = () => { if (A.st && A.st.game.status === 'running' && !confirm('Mäng juba käib. Alustada otsast? (punktid nullitakse)')) return; act('admin_start', {}, '▶️ Mäng käivitatud!'); };
$('#b-next').onclick = () => act('admin_next', {});
$('#b-end').onclick = () => { if (confirm('Lõpetada mäng ja näidata võitjaid?')) act('admin_end', {}, '🏁 Mäng lõpetatud'); };
$('#b-lobby').onclick = () => { if (confirm('Minna tagasi ootesaali? Punktid nullitakse, mängijad jäävad alles.')) act('admin_lobby', {}, '🔄 Ootesaal'); };

function renderGame(st) {
  const g = st.game;
  $('#g-dot').className = 'status-dot ' + g.status;
  $('#g-status').textContent = {lobby: 'Ootesaal – liitumine käib', running: 'Mäng käib!', ended: 'Mäng on lõppenud'}[g.status] || g.status;
  $('#g-phase').textContent = g.status === 'running' ? (PHASES[g.phase] || g.phase) : '–';
  $('#g-q').textContent = st.current ? `${g.q_index + 1} / ${g.q_total} · ${MODES[st.current.mode].icon} ${st.current.text}` : (g.status === 'lobby' ? `${st.questions.filter(q => q.active).length} aktiivset küsimust valmis` : '–');
  $('#g-ans').textContent = st.current ? `${st.current.answered} / ${st.online} (võrgus)` : '–';
  $('#g-pl').textContent = `${st.participants.length} kokku · ${st.online} võrgus`;
  $('#b-start').textContent = g.status === 'running' ? '🔁 Alusta uuesti' : '▶️ Käivita mäng';
  $('#b-next').disabled = g.status !== 'running';
  $('#b-end').disabled = g.status !== 'running';
  const cs = st.current && st.current.stats;
  $('#g-stats').innerHTML = cs ? `<div class="pill">✅ Õigesti: ${cs.correct} / ${cs.total}</div>` : '';
}

// ---------- leaderboard tab ----------
$('#tab-board').innerHTML = `<div class="card">
  <div class="row" style="justify-content:space-between"><h2 style="margin:0">🏆 Live edetabel</h2>
  <div class="row"><button class="btn small yellow" id="p-resetall">↺ Nulli kõigi punktid</button><button class="btn small red" id="p-clearall">🗑 Puhasta kogu edetabel</button></div></div>
  <p class="help">Iga rea juures saad mängija/tiimi punktid nullida (↺) või ta edetabelist eemaldada (🗑). Eemaldatud mängija saab uuesti liituda.</p>
  <div id="p-list"></div></div>`;
$('#p-resetall').onclick = () => { if (confirm('Nullida kõigi punktid?')) act('admin_p_reset_all', {}, '↺ Punktid nullitud'); };
$('#p-clearall').onclick = () => { if (confirm('Eemaldada KÕIK mängijad edetabelist?')) act('admin_p_clear_all', {}, '🗑 Edetabel puhas'); };
$('#p-list').onclick = e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = +b.dataset.id, name = b.dataset.name;
  if (b.dataset.act === 'del' && confirm(`Eemaldada „${name}“ edetabelist?`)) act('admin_p_delete', {id}, '🗑 Eemaldatud: ' + name);
  if (b.dataset.act === 'reset' && confirm(`Nullida „${name}“ punktid?`)) act('admin_p_reset', {id}, '↺ Nullitud: ' + name);
};
function renderBoard(st) {
  const h = JSON.stringify(st.participants); if (h === A.pHash) return; A.pHash = h;
  const ps = st.participants;
  $('#p-list').innerHTML = ps.length ? `<table class="list"><tr><th>#</th><th></th><th>Nimi</th><th>Tüüp</th><th>Punktid</th><th>Õiged</th><th>🔥</th><th></th></tr>` + ps.map((p, i) => `
    <tr class="it"><td><b>${i + 1}.</b></td><td style="font-size:1.6rem">${esc(p.avatar)}</td>
    <td><span class="dot ${p.online ? 'on' : ''}" title="${p.online ? 'võrgus' : 'pole võrgus'}"></span><b>${esc(p.name)}</b>${p.members ? `<div class="help">${esc(p.members)}</div>` : ''}</td>
    <td>${p.type === 'team' ? '👥 tiim' : '🙋 üksi'}</td><td><b>${fmtNum(p.score)}</b></td><td>${p.correct_count}</td><td>${p.best_streak}</td>
    <td><button class="btn small" data-act="reset" data-id="${p.id}" data-name="${esc(p.name)}" title="Nulli punktid">↺</button> <button class="btn small red" data-act="del" data-id="${p.id}" data-name="${esc(p.name)}" title="Eemalda">🗑</button></td></tr>`).join('') + '</table>'
    : '<p class="center muted" style="font-size:1.2rem">Edetabel on tühi 🐣</p>';
}

// ---------- questions tab ----------
$('#tab-questions').innerHTML = `<div class="card">
  <div class="row" style="justify-content:space-between"><h2 style="margin:0">❓ Küsimused</h2>
  <div class="row"><button class="btn primary" id="q-new">➕ Uus küsimus</button><button class="btn small" id="q-samples">🎁 Lisa näidisküsimused</button><button class="btn small" id="q-export">⬇️ Ekspordi</button><button class="btn small" id="q-import">⬆️ Impordi</button><button class="btn small red" id="q-delall">🗑 Kustuta kõik</button></div></div>
  <p class="help">Mängus kasutatakse ainult aktiivseid küsimusi (järjekord nagu siin, või segamini – vt Seaded).</p>
  <div id="q-list"></div></div>`;
$('#q-new').onclick = () => openQ(null);
$('#q-samples').onclick = () => act('admin_q_samples', {}, '🎁 Näidisküsimused lisatud');
$('#q-delall').onclick = () => { if (confirm('Kustutada KÕIK küsimused?') && confirm('Päriselt? Seda ei saa tagasi võtta.')) act('admin_q_delete_all', {}, '🗑 Küsimused kustutatud'); };
$('#q-export').onclick = () => {
  const data = (A.st ? A.st.questions : []).map(q => ({mode: q.mode, text: q.text, options: q.options, answer: q.answer, extra: q.extra, image: q.image, time_limit: q.time_limit, points: q.points, active: q.active}));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
  a.download = 'viktoriini-kusimused.json'; a.click();
};
$('#q-import').onclick = () => {
  const d = $('#iodlg');
  d.innerHTML = `<form id="if"><h2 style="margin-top:0">⬆️ Impordi küsimused</h2><p class="help">Vali varem eksporditud .json fail või kleebi JSON allolevasse kasti. Küsimused lisatakse olemasolevatele.</p>
    <input type="file" id="iff" accept=".json,application/json"><label>JSON</label><textarea id="ift" rows="8" placeholder='[{"mode":"classic","text":"...","options":["A","B"],"answer":0}]'></textarea>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button type="button" class="btn" id="ifc">Tühista</button><button class="btn primary">Impordi</button></div></form>`;
  d.showModal();
  $('#ifc').onclick = () => d.close();
  $('#iff').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { $('#ift').value = r.result; }; r.readAsText(f); };
  $('#if').onsubmit = async e => {
    e.preventDefault(); let arr;
    try { arr = JSON.parse($('#ift').value); } catch (x) { toast('JSON ei ole korrektne'); return; }
    try { const r = await call('admin_q_import', {questions: arr}); d.close(); toast(`⬆️ Imporditud ${r.count} küsimust`); load(); } catch (x) {}
  };
};
$('#q-list').onclick = e => {
  const b = e.target.closest('[data-q]'); if (!b) return;
  const id = +b.dataset.id, a = b.dataset.q;
  if (a === 'edit') openQ(A.st.questions.find(q => q.id === id));
  if (a === 'del' && confirm('Kustutada see küsimus?')) act('admin_q_delete', {id}, '🗑 Kustutatud');
  if (a === 'tog') act('admin_q_toggle', {id});
  if (a === 'up' || a === 'down') act('admin_q_move', {id, dir: a === 'up' ? -1 : 1});
};
function renderQuestions(st) {
  const h = JSON.stringify(st.questions); if (h === A.qHash) return; A.qHash = h;
  const qs = st.questions;
  $('#q-list').innerHTML = qs.length ? `<table class="list"><tr><th>#</th><th>Viis</th><th>Küsimus</th><th>Aeg</th><th>Aktiivne</th><th></th></tr>` + qs.map((q, i) => `
    <tr class="it ${q.active ? '' : 'off'}"><td><b>${i + 1}</b></td><td><span class="mode-badge">${MODES[q.mode].icon} ${MODES[q.mode].name}</span></td>
    <td>${esc(q.text)}<div class="help">${esc(answerText(Object.assign({}, q, {correct_order: q.options})))}</div></td><td>${q.time_limit}s</td>
    <td><button class="btn small" data-q="tog" data-id="${q.id}">${q.active ? '✅ jah' : '⛔ ei'}</button></td>
    <td><button class="btn small" data-q="up" data-id="${q.id}" ${i === 0 ? 'disabled' : ''}>⬆️</button> <button class="btn small" data-q="down" data-id="${q.id}" ${i === qs.length - 1 ? 'disabled' : ''}>⬇️</button> <button class="btn small blue" data-q="edit" data-id="${q.id}">✏️</button> <button class="btn small red" data-q="del" data-id="${q.id}">🗑</button></td></tr>`).join('') + '</table>'
    : '<p class="center muted" style="font-size:1.2rem">Küsimusi pole. Lisa uus või vajuta „Lisa näidisküsimused“ 🎁</p>';
}

function openQ(q) {
  const d = $('#qdlg'), isNew = !q;
  q = q || {mode: 'classic', text: '', options: ['', '', '', ''], answer: 0, extra: {}, image: '', time_limit: 20, points: 1000, active: 1};
  const S = {mode: q.mode, options: q.options && q.options.length ? q.options.slice() : ['', '', '', ''], correct: typeof q.answer === 'number' ? q.answer : 0,
    tf: q.mode === 'truefalse' ? q.answer : 1, extra: Object.assign({min: 0, max: 100, step: 1, unit: '', tolerance: 0}, q.extra || {}),
    sliderAns: q.mode === 'slider' ? q.answer : 50, accepted: Array.isArray(q.answer) ? q.answer.join('\n') : ''};
  d.innerHTML = `<form id="qf"><h2 style="margin-top:0">${isNew ? '➕ Uus küsimus' : '✏️ Muuda küsimust'}</h2>
    <label>Vastamise viis</label><select id="qm">${Object.keys(MODES).map(k => `<option value="${k}" ${k === S.mode ? 'selected' : ''}>${MODES[k].icon} ${MODES[k].name}</option>`).join('')}</select>
    <p class="help" id="qmh"></p>
    <label>Küsimus</label><textarea id="qt" rows="2" maxlength="300" required>${esc(q.text)}</textarea>
    <div id="qx"></div>
    <div class="f3"><div><label>Aeg (sek)</label><input id="qtl" type="number" min="5" max="180" value="${q.time_limit}"></div>
    <div><label>Punktid</label><input id="qp" type="number" min="0" max="5000" step="50" value="${q.points}"></div>
    <div><label>&nbsp;</label><label class="chk"><input type="checkbox" id="qa" ${q.active ? 'checked' : ''}> Aktiivne</label></div></div>
    <label>Pilt teleris (URL, valikuline)</label><input id="qi" value="${esc(q.image || '')}" placeholder="https://…/pilt.jpg">
    <div class="row" style="margin-top:16px;justify-content:flex-end"><button type="button" class="btn" id="qc">Tühista</button><button class="btn primary big">💾 Salvesta</button></div></form>`;
  const isChoice = m => m === 'classic' || m === 'catch' || m === 'balloon';
  function read() {
    if (isChoice(S.mode) || S.mode === 'order') {
      S.options = $$('.oi', d).map(i => i.value);
      const r = $('input[name=qcor]:checked', d); if (r) S.correct = +r.value;
    }
    if (S.mode === 'truefalse') { const r = $('input[name=qtf]:checked', d); if (r) S.tf = +r.value; }
    if (S.mode === 'slider') { ['min', 'max', 'step', 'tolerance'].forEach(k => S.extra[k] = $('#s-' + k, d).value); S.extra.unit = $('#s-unit', d).value; S.sliderAns = $('#s-ans', d).value; }
    if (S.mode === 'type') S.accepted = $('#t-acc', d).value;
  }
  function draw() {
    const m = S.mode, x = $('#qx', d);
    const qtl = $('#qtl', d);
    let mh = MODES[m].hint;
    if (m === 'catch') {
      mh += ' Soovitus: aeg vähemalt 30 s.';
      if (qtl && +qtl.value < 30) qtl.value = 30;
    }
    $('#qmh', d).textContent = mh;
    if (isChoice(m) || m === 'order') {
      x.innerHTML = `<label>${m === 'order' ? 'Vastused ÕIGES järjekorras (mängus segatakse)' : 'Vastusevariandid (märgi õige ⭕)'}</label>` + S.options.map((o, i) => `
        <div class="opt-row"><span class="sw" style="background:${OPT_COLORS[i]}"></span>${m === 'order' ? `<b style="width:26px">${i + 1}.</b>` : `<input type="radio" name="qcor" value="${i}" ${i === S.correct ? 'checked' : ''} title="Õige vastus">`}
        <input class="oi" maxlength="80" value="${esc(o)}" placeholder="Variant ${i + 1}"><button type="button" class="btn small" data-rm="${i}" ${S.options.length <= 2 ? 'disabled' : ''}>✖</button></div>`).join('') +
        (S.options.length < 6 ? '<button type="button" class="btn small" id="oadd">➕ Lisa variant</button>' : '');
      $$('[data-rm]', x).forEach(b => b.onclick = () => { read(); const i = +b.dataset.rm; S.options.splice(i, 1); if (S.correct >= S.options.length) S.correct = 0; else if (S.correct > i) S.correct--; draw(); });
      const ad = $('#oadd', x); if (ad) ad.onclick = () => { read(); S.options.push(''); draw(); };
    } else if (m === 'truefalse') {
      x.innerHTML = `<label>Õige vastus</label><div class="row"><label class="chk"><input type="radio" name="qtf" value="1" ${S.tf ? 'checked' : ''}> ✅ Väide on ÕIGE</label><label class="chk"><input type="radio" name="qtf" value="0" ${!S.tf ? 'checked' : ''}> ❌ Väide on VALE</label></div>`;
    } else if (m === 'slider') {
      const e = S.extra;
      x.innerHTML = `<div class="f3"><div><label>Miinimum</label><input id="s-min" type="number" step="any" value="${e.min}"></div><div><label>Maksimum</label><input id="s-max" type="number" step="any" value="${e.max}"></div><div><label>Samm</label><input id="s-step" type="number" step="any" min="0" value="${e.step}"></div></div>
        <div class="f3"><div><label>Õige vastus</label><input id="s-ans" type="number" step="any" value="${S.sliderAns}"></div><div><label>Lubatud viga ±</label><input id="s-tolerance" type="number" step="any" min="0" value="${e.tolerance}"></div><div><label>Ühik</label><input id="s-unit" maxlength="20" value="${esc(e.unit)}" placeholder="nt km"></div></div>
        <p class="help">Lähedased pakkumised saavad osa punkte.</p>`;
    } else if (m === 'type') {
      x.innerHTML = `<label>Õiged vastused (iga variant eraldi real)</label><textarea id="t-acc" rows="3" placeholder="suitsupääsuke&#10;pääsuke">${esc(S.accepted)}</textarea><p class="help">Suur- ja väiketähed ning täpitähed (õ, ä, ö, ü) ei loe.</p>`;
    }
  }
  draw(); d.showModal();
  $('#qm', d).onchange = () => { read(); S.mode = $('#qm', d).value; if ((isChoice(S.mode) || S.mode === 'order') && S.options.length < 2) S.options = ['', '', '', '']; draw(); };
  $('#qc', d).onclick = () => d.close();
  $('#qf', d).onsubmit = async e => {
    e.preventDefault(); read();
    const m = S.mode, payload = {mode: m, text: $('#qt', d).value, time_limit: +$('#qtl', d).value, points: +$('#qp', d).value, active: $('#qa', d).checked ? 1 : 0, image: $('#qi', d).value};
    if (isChoice(m)) { payload.options = S.options; const filled = S.options.map((o, i) => o.trim() ? i : -1).filter(i => i >= 0); payload.options = filled.map(i => S.options[i]); payload.answer = Math.max(0, filled.indexOf(S.correct)); if (filled.indexOf(S.correct) < 0) { toast('Märgi õige vastus (täidetud variantide hulgas)'); return; } }
    if (m === 'order') payload.options = S.options.filter(o => o.trim());
    if (m === 'truefalse') payload.answer = S.tf;
    if (m === 'slider') { payload.extra = S.extra; payload.answer = S.sliderAns; }
    if (m === 'type') payload.answer = S.accepted;
    try { await call('admin_q_save', {id: isNew ? 0 : q.id, q: payload}); d.close(); toast('💾 Salvestatud'); load(); } catch (x) {}
  };
}

// ---------- settings tab ----------
$('#tab-settings').innerHTML = `<form class="card" id="sf" style="max-width:720px">
  <h2 style="margin-top:0">⚙️ Seaded</h2>
  <label>Mängu nimi</label><input id="st-title" maxlength="60">
  <label>Kes saavad mängida?</label><select id="st-mode"><option value="both">🙋 Üksi ja 👥 tiimid</option><option value="solo">Ainult 🙋 üksi</option><option value="team">Ainult 👥 tiimid</option></select>
  <div class="f3"><div><label>Tutvustus (sek)</label><input id="st-intro" type="number" min="2" max="60"></div><div><label>Õige vastus (sek)</label><input id="st-reveal" type="number" min="2" max="60"></div><div><label>Edetabel (sek)</label><input id="st-board" type="number" min="2" max="60"></div></div>
  <label class="chk"><input type="checkbox" id="st-showboard"> Näita edetabelit küsimuste vahel</label>
  <label class="chk"><input type="checkbox" id="st-shuffle"> Sega küsimuste järjekord iga mängu alguses</label>
  <label class="chk"><input type="checkbox" id="st-lock"> 🔒 Lukusta liitumine (uued mängijad ei saa liituda)</label>
  <label>Liitumise aadress teleris (valikuline)</label><input id="st-url" maxlength="300" placeholder="tühjaks jättes tuvastatakse automaatselt">
  <p class="help">Näiteks lühilink. Tühjana näidatakse selle lehe aadressi.</p>
  <hr style="border:0;border-top:2px dashed rgba(61,44,94,.15);margin:20px 0">
  <h3 style="margin:0 0 10px">🎨 UI teema</h3>
  <label>Teema preset</label>
  <select id="st-theme"><option value="default">VOCO vaikimisi</option><option value="dark">Tume</option><option value="neon">Neon</option><option value="school">Kool</option></select>
  <label>Oma CSS (live — uueneb mängija- ja telerilehtedel)</label>
  <textarea id="st-css" class="css-edit" rows="8" maxlength="8000" placeholder="nt body.player { background: … } või :root { --pink: #ff0000; }"></textarea>
  <p class="help">Muutujad: <code>--pink</code>, <code>--green</code>, <code>--blue</code>, <code>--purple</code>, <code>--ink</code>, <code>--card</code>. Keha klassid: <code>body.player</code>, <code>body.tv</code>, <code>body.admin</code>.</p>
  <div class="row" style="gap:10px;margin-top:8px"><button type="button" class="btn blue" id="st-preview">👁 Eelvaade siin</button></div>
  <div style="height:10px"></div><button class="btn primary big">💾 Salvesta seaded</button>
  <p class="help" style="margin-top:16px">Adminparooli saab muuta failis <code>inc/config.php</code>.</p></form>`;
function fillSettings(s) {
  $('#st-title').value = s.title; $('#st-mode').value = s.allow_mode; $('#st-intro').value = s.intro_sec; $('#st-reveal').value = s.reveal_sec; $('#st-board').value = s.board_sec;
  $('#st-showboard').checked = s.show_board === '1'; $('#st-shuffle').checked = s.shuffle_q === '1'; $('#st-lock').checked = s.lock_join === '1'; $('#st-url').value = s.join_url || '';
  $('#st-theme').value = VQ_THEMES.includes(s.theme) ? s.theme : 'default';
  $('#st-css').value = s.custom_css || '';
  applyTheme({theme: $('#st-theme').value, custom_css: $('#st-css').value});
}
$('#st-preview').onclick = () => applyTheme({theme: $('#st-theme').value, custom_css: $('#st-css').value});
$('#sf').onsubmit = async e => {
  e.preventDefault();
  const settings = {title: $('#st-title').value, allow_mode: $('#st-mode').value, intro_sec: $('#st-intro').value, reveal_sec: $('#st-reveal').value, board_sec: $('#st-board').value,
    show_board: $('#st-showboard').checked ? '1' : '0', shuffle_q: $('#st-shuffle').checked ? '1' : '0', lock_join: $('#st-lock').checked ? '1' : '0', join_url: $('#st-url').value,
    theme: $('#st-theme').value, custom_css: $('#st-css').value};
  try { await call('admin_settings', {settings}); toast('💾 Seaded salvestatud'); applyTheme(settings); A.settingsLoaded = false; load(); $('#adm-title').textContent = settings.title; } catch (x) {}
};

// ---------- loop ----------
let loading = false;
async function load() {
  if (loading) return; loading = true;
  try {
    const st = await call('admin_state', {});
    A.st = st; renderGame(st); renderBoard(st); renderQuestions(st);
    if (!A.settingsLoaded) { fillSettings(st.settings); A.settingsLoaded = true; }
  } catch (e) {}
  loading = false;
}
setInterval(() => {
  const st = A.st; if (!st) return;
  const el = $('#g-left');
  el.textContent = st.game.status === 'running' ? Math.max(0, Math.ceil(st.game.phase_ends - Clock.now())) + ' s' : '–';
}, 250);
setInterval(load, 2000); load();
