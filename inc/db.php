<?php
require_once __DIR__ . '/config.php';

const VQ_MODES = ['classic', 'catch', 'balloon', 'truefalse', 'slider', 'order', 'type'];
const VQ_AVATARS = ['🐱','🐶','🐼','🦊','🐸','🐵','🐰','🐻','🐨','🐯','🦄','🐙','🐧','🐥','🦖','🐳','🐹','🦁','🐮','🐷','🐲','🦉','🐝','🦋'];

function db() {
    static $pdo = null;
    if ($pdo) return $pdo;
    if (!extension_loaded('pdo_sqlite')) throw new Exception('Serveris puudub PHP laiendus pdo_sqlite (paigalda nt php-sqlite3).');
    if (!is_dir(DATA_DIR)) @mkdir(DATA_DIR, 0775, true);
    if (!is_writable(DATA_DIR)) throw new Exception('Kaust "game/data" peab olema veebiserverile kirjutatav (nt chmod 775 või 777).');
    $new = !file_exists(DB_FILE) || filesize(DB_FILE) === 0;
    $pdo = new PDO('sqlite:' . DB_FILE);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA busy_timeout = 6000');
    $pdo->exec('PRAGMA synchronous = NORMAL');
    if ($new) {
        try { $pdo->exec('PRAGMA journal_mode = WAL'); } catch (Throwable $e) {}
        vq_schema($pdo);
    }
    return $pdo;
}

function vq_schema($db) {
    $db->exec("CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT)");
    $db->exec("CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY AUTOINCREMENT, sort INTEGER DEFAULT 0, mode TEXT NOT NULL, text TEXT NOT NULL, options TEXT DEFAULT '[]', answer TEXT DEFAULT 'null', extra TEXT DEFAULT '{}', image TEXT DEFAULT '', time_limit INTEGER DEFAULT 20, points INTEGER DEFAULT 1000, active INTEGER DEFAULT 1)");
    $db->exec("CREATE TABLE IF NOT EXISTS participants (id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT NOT NULL, name TEXT NOT NULL, type TEXT DEFAULT 'solo', members TEXT DEFAULT '', avatar TEXT DEFAULT '', score INTEGER DEFAULT 0, streak INTEGER DEFAULT 0, best_streak INTEGER DEFAULT 0, correct_count INTEGER DEFAULT 0, joined REAL DEFAULT 0, last_seen REAL DEFAULT 0)");
    $db->exec("CREATE TABLE IF NOT EXISTS answers (id INTEGER PRIMARY KEY AUTOINCREMENT, round INTEGER, pid INTEGER, qid INTEGER, answer TEXT, correct INTEGER DEFAULT 0, points INTEGER DEFAULT 0, elapsed REAL DEFAULT 0, created REAL DEFAULT 0, UNIQUE(round, pid, qid))");
    $db->exec("CREATE TABLE IF NOT EXISTS game (id INTEGER PRIMARY KEY CHECK (id = 1), status TEXT DEFAULT 'lobby', round INTEGER DEFAULT 0, q_order TEXT DEFAULT '[]', q_index INTEGER DEFAULT 0, phase TEXT DEFAULT '', phase_started REAL DEFAULT 0, phase_ends REAL DEFAULT 0, started_at REAL DEFAULT 0, ended_at REAL DEFAULT 0)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_participants_score ON participants (score DESC, correct_count DESC, id ASC)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_participants_seen ON participants (last_seen)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_answers_round_qid ON answers (round, qid)");
    $db->exec("INSERT OR IGNORE INTO game (id) VALUES (1)");
    $st = $db->prepare("INSERT OR IGNORE INTO settings (k, v) VALUES (?, ?)");
    foreach (vq_default_settings() as $k => $v) $st->execute([$k, $v]);
    if ((int)$db->query("SELECT COUNT(*) FROM questions")->fetchColumn() === 0) vq_seed_samples($db);
}

function vq_default_settings() {
    return ['title' => 'VOCO Viktoriin', 'allow_mode' => 'both', 'intro_sec' => '6', 'reveal_sec' => '7',
            'board_sec' => '7', 'show_board' => '1', 'shuffle_q' => '0', 'lock_join' => '0', 'join_url' => '',
            'theme' => 'default', 'custom_css' => ''];
}

function vq_theme_class($theme) {
    $allowed = ['default', 'dark', 'neon', 'school'];
    return in_array($theme, $allowed, true) ? $theme : 'default';
}

function vq_settings() {
    $s = vq_default_settings();
    foreach (db()->query("SELECT k, v FROM settings") as $r) $s[$r['k']] = $r['v'];
    return $s;
}

function vq_session() {
    if (session_status() !== PHP_SESSION_ACTIVE) { session_name('VOCOQUIZ'); session_start(); }
}

function vq_tx($fn) {
    $db = db();
    $db->exec('BEGIN IMMEDIATE');
    try { $r = $fn($db); $db->exec('COMMIT'); return $r; }
    catch (Throwable $e) { try { $db->exec('ROLLBACK'); } catch (Throwable $x) {} throw $e; }
}

// ---------- text helpers ----------
function vq_cut($s, $n) {
    $s = trim((string)preg_replace('/\s+/u', ' ', strip_tags((string)$s)));
    if (function_exists('mb_substr')) return mb_substr($s, 0, $n, 'UTF-8');
    return preg_match('/^.{0,' . (int)$n . '}/us', $s, $m) ? $m[0] : '';
}
function vq_len($s) { return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : (int)preg_match_all('/./us', $s); }
function vq_norm($s) {
    $s = trim((string)$s);
    $s = function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : strtolower($s);
    $s = strtr($s, ['õ'=>'o','ä'=>'a','ö'=>'o','ü'=>'u','š'=>'s','ž'=>'z','Õ'=>'o','Ä'=>'a','Ö'=>'o','Ü'=>'u','Š'=>'s','Ž'=>'z','₂'=>'2']);
    $s = (string)preg_replace('/[^\p{L}\p{N}]+/u', ' ', $s);
    return trim($s);
}

// ---------- questions ----------
function vq_q_row($r) {
    if (!$r) return null;
    $r['id'] = (int)$r['id']; $r['sort'] = (int)$r['sort'];
    $r['options'] = json_decode($r['options'], true) ?: [];
    $r['answer'] = json_decode($r['answer'], true);
    $r['extra'] = json_decode($r['extra'], true) ?: [];
    $r['time_limit'] = (int)$r['time_limit']; $r['points'] = (int)$r['points']; $r['active'] = (int)$r['active'];
    return $r;
}
function vq_q_get($id) {
    $st = db()->prepare("SELECT * FROM questions WHERE id = ?");
    $st->execute([(int)$id]);
    return vq_q_row($st->fetch());
}
function vq_q_all() {
    return array_map('vq_q_row', db()->query("SELECT * FROM questions ORDER BY sort, id")->fetchAll());
}

function vq_q_sanitize($in) {
    $mode = isset($in['mode']) ? (string)$in['mode'] : '';
    if (!in_array($mode, VQ_MODES, true)) throw new Exception('Tundmatu vastamise viis');
    $text = vq_cut(isset($in['text']) ? $in['text'] : '', 300);
    if ($text === '') throw new Exception('Küsimuse tekst puudub');
    $tl = (int)(isset($in['time_limit']) ? $in['time_limit'] : 20); $tl = max(5, min(180, $tl ? $tl : 20));
    $pts = isset($in['points']) && $in['points'] !== '' ? (int)$in['points'] : 1000; $pts = max(0, min(5000, $pts));
    $img = vq_cut(isset($in['image']) ? $in['image'] : '', 500);
    $opts = [];
    foreach ((array)(isset($in['options']) ? $in['options'] : []) as $o) { $o = vq_cut($o, 80); if ($o !== '') $opts[] = $o; }
    $answer = null; $extra = new stdClass();
    if (in_array($mode, ['classic', 'catch', 'balloon', 'order'], true)) {
        if (count($opts) < 2 || count($opts) > 6) throw new Exception('Lisa 2–6 vastusevarianti');
    } else $opts = [];
    $a = isset($in['answer']) ? $in['answer'] : null;
    if (in_array($mode, ['classic', 'catch', 'balloon'], true)) {
        $answer = (int)$a;
        if ($answer < 0 || $answer >= count($opts)) throw new Exception('Märgi õige vastus');
    } elseif ($mode === 'truefalse') {
        $answer = ($a === true || $a === 1 || $a === '1' || $a === 'true') ? 1 : 0;
    } elseif ($mode === 'slider') {
        $e = (array)(isset($in['extra']) ? $in['extra'] : []);
        $min = (float)(isset($e['min']) ? $e['min'] : 0); $max = (float)(isset($e['max']) ? $e['max'] : 100);
        $step = (float)(isset($e['step']) ? $e['step'] : 1); if ($step <= 0) $step = 1;
        if ($max <= $min) throw new Exception('Liuguri maksimum peab olema miinimumist suurem');
        $answer = (float)($a === null || $a === '' ? $min : $a);
        if ($answer < $min || $answer > $max) throw new Exception('Õige vastus peab jääma liuguri vahemikku');
        $extra = ['min' => $min, 'max' => $max, 'step' => $step, 'unit' => vq_cut(isset($e['unit']) ? $e['unit'] : '', 20),
                  'tolerance' => max(0, (float)(isset($e['tolerance']) ? $e['tolerance'] : 0))];
    } elseif ($mode === 'type') {
        $acc = is_array($a) ? $a : preg_split('/[|\n]+/u', (string)$a);
        $list = [];
        foreach ($acc as $x) { $x = vq_cut($x, 80); if ($x !== '' && !in_array($x, $list, true)) $list[] = $x; }
        if (!$list) throw new Exception('Lisa vähemalt üks õige vastus');
        $answer = $list;
    }
    $active = isset($in['active']) ? (($in['active'] === false || $in['active'] === 0 || $in['active'] === '0') ? 0 : 1) : 1;
    return ['mode' => $mode, 'text' => $text, 'options' => $opts, 'answer' => $answer, 'extra' => $extra,
            'image' => $img, 'time_limit' => $tl, 'points' => $pts, 'active' => $active];
}

function vq_q_insert($db, $q) {
    $sort = (int)$db->query("SELECT COALESCE(MAX(sort), 0) + 1 FROM questions")->fetchColumn();
    $st = $db->prepare("INSERT INTO questions (sort, mode, text, options, answer, extra, image, time_limit, points, active) VALUES (?,?,?,?,?,?,?,?,?,?)");
    $st->execute([$sort, $q['mode'], $q['text'], json_encode($q['options'], JSON_UNESCAPED_UNICODE), json_encode($q['answer'], JSON_UNESCAPED_UNICODE),
                  json_encode($q['extra'], JSON_UNESCAPED_UNICODE), $q['image'], $q['time_limit'], $q['points'], $q['active']]);
    return (int)$db->lastInsertId();
}

function vq_samples() {
    return [
        ['mode'=>'classic','text'=>'Mitu jalga on ämblikul? 🕷️','options'=>['6','8','10','12'],'answer'=>1,'time_limit'=>20],
        ['mode'=>'catch','text'=>'Püüa kinni Eesti pealinn! 🏰','options'=>['Tartu','Tallinn','Pärnu','Narva'],'answer'=>1,'time_limit'=>25],
        ['mode'=>'truefalse','text'=>'Kass võib magada kuni 16 tundi päevas. 😴','answer'=>1,'time_limit'=>15],
        ['mode'=>'balloon','text'=>'Löö lõhki õhupall, millel on PUUVILI! 🍌','options'=>['Kartul','Banaan','Porgand','Sibul'],'answer'=>1,'time_limit'=>25],
        ['mode'=>'slider','text'=>'Mitu päeva on liigaastas? 📅','answer'=>366,'extra'=>['min'=>300,'max'=>400,'step'=>1,'unit'=>'päeva','tolerance'=>0],'time_limit'=>20],
        ['mode'=>'order','text'=>'Järjesta loomad väiksemast suuremani! 🐭➡️🐘','options'=>['Hiir','Kass','Hobune','Elevant'],'time_limit'=>30],
        ['mode'=>'type','text'=>'Mis on Eesti rahvuslind? 🐦','answer'=>['suitsupääsuke','pääsuke','pääsukene'],'time_limit'=>25],
        ['mode'=>'classic','text'=>'Mis on 7 × 8? 🧮','options'=>['54','56','58','64'],'answer'=>1,'time_limit'=>15],
        ['mode'=>'catch','text'=>'Püüa planeet, mis on Päikesele kõige lähemal! ☀️','options'=>['Merkuur','Veenus','Maa','Marss'],'answer'=>0,'time_limit'=>25],
        ['mode'=>'truefalse','text'=>'Pingviinid elavad põhjapoolusel. 🐧','answer'=>0,'time_limit'=>15],
        ['mode'=>'balloon','text'=>'Löö lõhki loom, kes oskab lennata! 🕊️','options'=>['🐧 Pingviin','🦉 Öökull','🐢 Kilpkonn','🐟 Kala'],'answer'=>1,'time_limit'=>25],
        ['mode'=>'slider','text'=>'Mis aastal taastas Eesti iseseisvuse? 🇪🇪','answer'=>1991,'extra'=>['min'=>1980,'max'=>2000,'step'=>1,'unit'=>'','tolerance'=>0],'time_limit'=>20],
        ['mode'=>'order','text'=>'Pane aastaajad järjekorda, alustades talvest! ❄️','options'=>['Talv','Kevad','Suvi','Sügis'],'time_limit'=>25],
        ['mode'=>'type','text'=>'Mis on vee keemiline valem? 💧','answer'=>['H2O'],'time_limit'=>20],
        ['mode'=>'classic','text'=>'Mis keelt räägitakse Brasiilias? 🇧🇷','options'=>['Hispaania','Portugali','Prantsuse','Inglise'],'answer'=>1,'time_limit'=>20],
    ];
}
function vq_seed_samples($db) { foreach (vq_samples() as $q) vq_q_insert($db, vq_q_sanitize($q)); }

function vq_q_public($q, $g, $reveal, $intro = false) {
    $o = ['id' => $q['id'], 'mode' => $q['mode'], 'text' => $q['text'], 'image' => $q['image'], 'time_limit' => $q['time_limit'], 'points' => $q['points']];
    if ($intro) return $o;
    $m = $q['mode'];
    if (in_array($m, ['classic', 'catch', 'balloon'], true)) $o['options'] = $q['options'];
    if ($m === 'order') {
        $items = [];
        foreach ($q['options'] as $i => $t) $items[] = ['i' => $i, 't' => $t];
        mt_srand(crc32($q['id'] . '-' . $g['round']));
        for ($i = count($items) - 1; $i > 0; $i--) { $j = mt_rand(0, $i); $tmp = $items[$i]; $items[$i] = $items[$j]; $items[$j] = $tmp; }
        mt_srand();
        $same = true; foreach ($items as $k => $it) if ($it['i'] !== $k) { $same = false; break; }
        if ($same) $items = array_reverse($items);
        $o['items'] = $items;
    }
    if ($m === 'slider') $o['extra'] = ['min' => $q['extra']['min'], 'max' => $q['extra']['max'], 'step' => $q['extra']['step'], 'unit' => $q['extra']['unit']];
    if ($reveal) {
        $o['answer'] = $q['answer'];
        if ($m === 'order') $o['correct_order'] = $q['options'];
        if ($m === 'slider') $o['extra']['tolerance'] = $q['extra']['tolerance'];
    }
    return $o;
}

function vq_evaluate($q, $ans) {
    $m = $q['mode']; $a = $q['answer'];
    if (in_array($m, ['classic', 'catch', 'balloon'], true)) {
        $i = (int)$ans;
        if ($i < 0 || $i >= count($q['options'])) throw new Exception('Vigane vastus');
        return [$i === (int)$a, $i === (int)$a ? 1 : 0, $i];
    }
    if ($m === 'truefalse') {
        $v = ($ans === true || $ans === 1 || $ans === '1' || $ans === 'true') ? 1 : 0;
        return [$v === (int)$a, $v === (int)$a ? 1 : 0, $v];
    }
    if ($m === 'slider') {
        $e = $q['extra']; $v = (float)$ans;
        $v = max((float)$e['min'], min((float)$e['max'], $v));
        $range = max(0.000001, $e['max'] - $e['min']); $diff = abs($v - (float)$a);
        $ok = $diff <= (float)$e['tolerance'] + 0.0000001;
        $frac = $ok ? 1 : max(0, 1 - $diff / ($range * 0.25));
        return [$ok, $frac, $v];
    }
    if ($m === 'order') {
        $arr = array_values(array_map('intval', (array)$ans)); $n = count($q['options']); $k = 0;
        for ($i = 0; $i < $n; $i++) if (isset($arr[$i]) && $arr[$i] === $i) $k++;
        return [$k === $n, $n ? $k / $n : 0, $arr];
    }
    if ($m === 'type') {
        $v = vq_cut(is_scalar($ans) ? $ans : '', 60); $nv = vq_norm($v); $ok = false;
        foreach ((array)$a as $acc) if ($nv !== '' && vq_norm($acc) === $nv) $ok = true;
        return [$ok, $ok ? 1 : 0, $v];
    }
    throw new Exception('Tundmatu küsimus');
}

// ---------- game engine ----------
function vq_game() {
    $g = db()->query("SELECT * FROM game WHERE id = 1")->fetch();
    $g['round'] = (int)$g['round']; $g['q_index'] = (int)$g['q_index'];
    $g['phase_started'] = (float)$g['phase_started']; $g['phase_ends'] = (float)$g['phase_ends'];
    $g['order'] = json_decode($g['q_order'], true) ?: [];
    return $g;
}
function vq_current_qid($g) { return isset($g['order'][$g['q_index']]) ? (int)$g['order'][$g['q_index']] : 0; }
function vq_online_count($now) { return (int)db()->query("SELECT COUNT(*) FROM participants WHERE last_seen > " . ($now - 20))->fetchColumn(); }
function vq_answered_count($g) {
    $st = db()->prepare("SELECT COUNT(*) FROM answers a JOIN participants p ON p.id = a.pid WHERE a.round = ? AND a.qid = ?");
    $st->execute([$g['round'], vq_current_qid($g)]);
    return (int)$st->fetchColumn();
}

function vq_needs_tick($g, $now) {
    if ($g['status'] !== 'running') return false;
    if ($now >= $g['phase_ends']) return true;
    if ($g['phase'] === 'question' && $now - $g['phase_started'] > 1.5) {
        $online = vq_online_count($now); $ans = vq_answered_count($g);
        if ($ans > 0 && $ans >= $online) return true;
    }
    return false;
}

function vq_tick() {
    $g = vq_game(); $now = microtime(true);
    if (!vq_needs_tick($g, $now)) return $g;
    vq_tx(function ($db) {
        $g = vq_game(); $now = microtime(true);
        if (vq_needs_tick($g, $now)) vq_advance($g, $now);
    });
    return vq_game();
}

function vq_set_phase($phase, $idx, $now, $dur) {
    db()->prepare("UPDATE game SET phase = ?, q_index = ?, phase_started = ?, phase_ends = ? WHERE id = 1")->execute([$phase, $idx, $now, $now + max(1, $dur)]);
}

function vq_end_game($now) {
    db()->prepare("UPDATE game SET status = 'ended', phase = '', ended_at = ?, phase_started = ?, phase_ends = 0 WHERE id = 1")->execute([$now, $now]);
}

function vq_advance($g, $now) {
    $s = vq_settings(); $idx = $g['q_index']; $n = count($g['order']);
    switch ($g['phase']) {
        case 'intro':
            $q = vq_q_get(vq_current_qid($g));
            if (!$q) { vq_end_game($now); return; }
            $lim = max(5, (int)$q['time_limit']);
            if ($q['mode'] === 'catch') $lim = max($lim, 30);
            vq_set_phase('question', $idx, $now, $lim);
            return;
        case 'question':
            db()->prepare("UPDATE participants SET streak = 0 WHERE id NOT IN (SELECT pid FROM answers WHERE round = ? AND qid = ?)")->execute([$g['round'], vq_current_qid($g)]);
            vq_set_phase('reveal', $idx, $now, (int)$s['reveal_sec']);
            return;
        case 'reveal':
            if ($idx >= $n - 1) { vq_end_game($now); return; }
            if ($s['show_board'] === '1') vq_set_phase('board', $idx, $now, (int)$s['board_sec']);
            else vq_set_phase('intro', $idx + 1, $now, (int)$s['intro_sec']);
            return;
        case 'board':
            vq_set_phase('intro', $idx + 1, $now, (int)$s['intro_sec']);
            return;
        default:
            vq_end_game($now);
    }
}

function vq_start_game() {
    $s = vq_settings(); $db = db();
    $ids = array_map('intval', $db->query("SELECT id FROM questions WHERE active = 1 ORDER BY sort, id")->fetchAll(PDO::FETCH_COLUMN));
    if (!$ids) throw new Exception('Pole ühtegi aktiivset küsimust – lisa küsimusi!');
    if ($s['shuffle_q'] === '1') shuffle($ids);
    vq_tx(function ($db) use ($ids, $s) {
        $now = microtime(true); $g = vq_game();
        $db->exec("DELETE FROM answers");
        $db->exec("UPDATE participants SET score = 0, streak = 0, best_streak = 0, correct_count = 0");
        $db->prepare("UPDATE game SET status = 'running', round = ?, q_order = ?, q_index = 0, phase = 'intro', phase_started = ?, phase_ends = ?, started_at = ?, ended_at = 0 WHERE id = 1")
           ->execute([$g['round'] + 1, json_encode($ids), $now, $now + (int)$s['intro_sec'] + 2, $now]);
    });
}

function vq_reset_lobby() {
    vq_tx(function ($db) {
        $db->exec("DELETE FROM answers");
        $db->exec("UPDATE participants SET score = 0, streak = 0, best_streak = 0, correct_count = 0");
        $db->exec("UPDATE game SET status = 'lobby', phase = '', q_index = 0, q_order = '[]', phase_started = 0, phase_ends = 0 WHERE id = 1");
    });
}

function vq_stats($q, $g) {
    $st = db()->prepare("SELECT a.answer, a.correct FROM answers a JOIN participants p ON p.id = a.pid WHERE a.round = ? AND a.qid = ?");
    $st->execute([$g['round'], $q['id']]);
    $rows = $st->fetchAll();
    $res = ['total' => count($rows), 'correct' => 0];
    $m = $q['mode'];
    if (in_array($m, ['classic', 'catch', 'balloon'], true)) $res['counts'] = array_fill(0, count($q['options']), 0);
    if ($m === 'truefalse') $res['counts'] = [0, 0];
    $sum = 0;
    foreach ($rows as $r) {
        if ($r['correct']) $res['correct']++;
        $v = json_decode($r['answer'], true);
        if (isset($res['counts']) && is_numeric($v) && isset($res['counts'][(int)$v])) $res['counts'][(int)$v]++;
        if ($m === 'slider') $sum += (float)$v;
    }
    if ($m === 'slider' && $rows) $res['avg'] = round($sum / count($rows), 2);
    return $res;
}

function vq_leaderboard($limit = 0) {
    $sql = "SELECT id, name, type, members, avatar, score, streak, best_streak, correct_count, last_seen FROM participants ORDER BY score DESC, correct_count DESC, id ASC";
    if ($limit) $sql .= " LIMIT " . (int)$limit;
    $rows = db()->query($sql)->fetchAll(); $now = microtime(true);
    foreach ($rows as &$r) {
        foreach (['id', 'score', 'streak', 'best_streak', 'correct_count'] as $k) $r[$k] = (int)$r[$k];
        $r['online'] = ($now - (float)$r['last_seen']) < 20; unset($r['last_seen']);
    }
    return $rows;
}

function vq_player($in) {
    $id = (int)(isset($in['pid']) ? $in['pid'] : 0); $tok = (string)(isset($in['token']) ? $in['token'] : '');
    if (!$id || $tok === '') return null;
    $st = db()->prepare("SELECT * FROM participants WHERE id = ?");
    $st->execute([$id]); $p = $st->fetch();
    if (!$p || !hash_equals($p['token'], $tok)) return null;
    return $p;
}

// ---------- public API ----------
function vq_api_state($in) {
    $db = db(); $g = vq_tick(); $now = microtime(true); $s = vq_settings();
    $role = isset($in['role']) ? $in['role'] : 'player';
    $res = ['ok' => true, 'now' => $now, 'status' => $g['status'], 'phase' => $g['phase'], 'round' => $g['round'],
            'q_index' => $g['q_index'], 'q_total' => count($g['order']), 'phase_started' => $g['phase_started'], 'phase_ends' => $g['phase_ends'],
            'title' => $s['title'], 'allow_mode' => $s['allow_mode'], 'lock_join' => $s['lock_join'] === '1',
            'theme' => vq_theme_class(isset($s['theme']) ? $s['theme'] : 'default'),
            'custom_css' => isset($s['custom_css']) ? (string)$s['custom_css'] : '',
            'players' => (int)$db->query("SELECT COUNT(*) FROM participants")->fetchColumn(), 'online' => vq_online_count($now)];
    $q = null;
    if ($g['status'] === 'running' && ($qid = vq_current_qid($g))) {
        $q = vq_q_get($qid);
        if ($q) {
            $reveal = in_array($g['phase'], ['reveal', 'board'], true);
            $res['question'] = vq_q_public($q, $g, $reveal, $g['phase'] === 'intro');
            $res['answered'] = vq_answered_count($g);
            if ($reveal) $res['stats'] = vq_stats($q, $g);
        }
    }
    if ($role === 'tv') {
        $res['join_url'] = $s['join_url'];
        if ($g['status'] === 'lobby') $res['people'] = $db->query("SELECT id, name, type, avatar FROM participants ORDER BY id DESC LIMIT 80")->fetchAll();
        if ($g['phase'] === 'board' || $g['status'] !== 'running') $res['board'] = vq_leaderboard(10);
    } else {
        $p = vq_player($in); $res['me'] = null;
        if ($p) {
            if ($now - (float)$p['last_seen'] > 8) $db->prepare("UPDATE participants SET last_seen = ? WHERE id = ?")->execute([$now, $p['id']]);
            $rk = $db->prepare("SELECT COUNT(*) FROM participants WHERE score > ?"); $rk->execute([(int)$p['score']]);
            $res['me'] = ['id' => (int)$p['id'], 'name' => $p['name'], 'type' => $p['type'], 'avatar' => $p['avatar'], 'members' => $p['members'],
                          'score' => (int)$p['score'], 'streak' => (int)$p['streak'], 'correct' => (int)$p['correct_count'], 'rank' => 1 + (int)$rk->fetchColumn()];
            if ($q) {
                $st = $db->prepare("SELECT answer, correct, points FROM answers WHERE round = ? AND pid = ? AND qid = ?");
                $st->execute([$g['round'], $p['id'], $q['id']]); $a = $st->fetch();
                if ($a) {
                    $res['my'] = ['answered' => true];
                    if (in_array($g['phase'], ['reveal', 'board'], true)) $res['my'] += ['correct' => (bool)$a['correct'], 'points' => (int)$a['points'], 'answer' => json_decode($a['answer'], true)];
                } else $res['my'] = ['answered' => false];
            }
            if ($g['status'] === 'ended') $res['board'] = vq_leaderboard(3);
        }
    }
    return $res;
}

function vq_api_join($in) {
    $s = vq_settings();
    if ($s['lock_join'] === '1') throw new Exception('Liitumine on hetkel suletud 🔒');
    $name = vq_cut(isset($in['name']) ? $in['name'] : '', 24);
    if (vq_len($name) < 2) throw new Exception('Nimi peab olema vähemalt 2 tähemärki');
    $type = (isset($in['type']) && $in['type'] === 'team') ? 'team' : 'solo';
    if ($s['allow_mode'] === 'solo' && $type === 'team') throw new Exception('Praegu saab mängida ainult üksi');
    if ($s['allow_mode'] === 'team' && $type === 'solo') throw new Exception('Praegu saab mängida ainult tiimina');
    $members = $type === 'team' ? vq_cut(isset($in['members']) ? $in['members'] : '', 150) : '';
    $avatar = (isset($in['avatar']) && in_array($in['avatar'], VQ_AVATARS, true)) ? $in['avatar'] : VQ_AVATARS[array_rand(VQ_AVATARS)];
    return vq_tx(function ($db) use ($name, $type, $members, $avatar) {
        foreach ($db->query("SELECT name FROM participants")->fetchAll(PDO::FETCH_COLUMN) as $n)
            if (vq_norm($n) === vq_norm($name)) throw new Exception('See nimi on juba võetud – lisa näiteks number 😊');
        $tok = bin2hex(random_bytes(16)); $now = microtime(true);
        $db->prepare("INSERT INTO participants (token, name, type, members, avatar, joined, last_seen) VALUES (?,?,?,?,?,?,?)")
           ->execute([$tok, $name, $type, $members, $avatar, $now, $now]);
        return ['ok' => true, 'id' => (int)$db->lastInsertId(), 'token' => $tok];
    });
}

function vq_api_answer($in) {
    return vq_tx(function ($db) use ($in) {
        $p = vq_player($in);
        if (!$p) throw new Exception('Mängijat ei leitud – liitu uuesti');
        $g = vq_game(); $now = microtime(true);
        if ($g['status'] !== 'running' || $g['phase'] !== 'question') throw new Exception('Praegu ei saa vastata');
        if ($now > $g['phase_ends'] + 1.0) throw new Exception('Aeg sai otsa ⏰');
        $qid = vq_current_qid($g);
        if ((int)(isset($in['qid']) ? $in['qid'] : 0) !== $qid) throw new Exception('See küsimus on juba möödas');
        $q = vq_q_get($qid);
        $chk = $db->prepare("SELECT COUNT(*) FROM answers WHERE round = ? AND pid = ? AND qid = ?");
        $chk->execute([$g['round'], $p['id'], $qid]);
        if ($chk->fetchColumn()) throw new Exception('Oled juba vastanud');
        list($ok, $frac, $norm) = vq_evaluate($q, isset($in['answer']) ? $in['answer'] : null);
        $lim = max(1, $g['phase_ends'] - $g['phase_started']);
        $el = max(0, min($lim, $now - $g['phase_started']));
        $tf = 1 - 0.5 * ($el / $lim);
        $base = $q['points'];
        if ($ok) { $streak = (int)$p['streak'] + 1; $bonus = min($streak - 1, 5) * 100; $pts = (int)round($base * $tf) + ($base > 0 ? $bonus : 0); }
        else { $streak = 0; $bonus = 0; $pts = (int)round($base * 0.5 * $frac * $tf); }
        $db->prepare("INSERT INTO answers (round, pid, qid, answer, correct, points, elapsed, created) VALUES (?,?,?,?,?,?,?,?)")
           ->execute([$g['round'], $p['id'], $qid, json_encode($norm, JSON_UNESCAPED_UNICODE), $ok ? 1 : 0, $pts, $el, $now]);
        $db->prepare("UPDATE participants SET score = score + ?, streak = ?, best_streak = MAX(best_streak, ?), correct_count = correct_count + ?, last_seen = ? WHERE id = ?")
           ->execute([$pts, $streak, $streak, $ok ? 1 : 0, $now, $p['id']]);
        return ['ok' => true];
    });
}

// ---------- admin API ----------
function vq_admin($action, $in) {
    $db = db();
    $id = (int)(isset($in['id']) ? $in['id'] : 0);
    switch ($action) {
        case 'admin_state':
            $g = vq_tick(); $now = microtime(true); $cur = null;
            if ($g['status'] === 'running' && ($q = vq_q_get(vq_current_qid($g)))) {
                $cur = ['id' => $q['id'], 'text' => $q['text'], 'mode' => $q['mode'], 'answered' => vq_answered_count($g)];
                if (in_array($g['phase'], ['reveal', 'board'], true)) $cur['stats'] = vq_stats($q, $g);
            }
            return ['ok' => true, 'now' => $now, 'game' => ['status' => $g['status'], 'phase' => $g['phase'], 'q_index' => $g['q_index'], 'q_total' => count($g['order']),
                    'phase_ends' => $g['phase_ends'], 'round' => $g['round']], 'online' => vq_online_count($now),
                    'settings' => vq_settings(), 'questions' => vq_q_all(), 'participants' => vq_leaderboard(0), 'current' => $cur];
        case 'admin_start': vq_start_game(); return ['ok' => true];
        case 'admin_next':
            $g = vq_game();
            if ($g['status'] !== 'running') { vq_start_game(); return ['ok' => true]; }
            vq_tx(function ($db) { $g = vq_game(); if ($g['status'] === 'running') vq_advance($g, microtime(true)); });
            return ['ok' => true];
        case 'admin_end':
            vq_tx(function ($db) { $g = vq_game(); if ($g['status'] === 'running') vq_end_game(microtime(true)); });
            return ['ok' => true];
        case 'admin_lobby': vq_reset_lobby(); return ['ok' => true];
        case 'admin_settings':
            $allowed = vq_default_settings(); $st = $db->prepare("INSERT OR REPLACE INTO settings (k, v) VALUES (?, ?)");
            foreach ((array)(isset($in['settings']) ? $in['settings'] : []) as $k => $v) {
                if (!array_key_exists($k, $allowed)) continue;
                $maxLen = $k === 'custom_css' ? 8000 : 300;
                $v = vq_cut(is_bool($v) ? ($v ? '1' : '0') : $v, $maxLen);
                if (in_array($k, ['intro_sec', 'reveal_sec', 'board_sec'], true)) $v = (string)max(2, min(60, (int)$v));
                if (in_array($k, ['show_board', 'shuffle_q', 'lock_join'], true)) $v = $v === '1' ? '1' : '0';
                if ($k === 'allow_mode' && !in_array($v, ['both', 'solo', 'team'], true)) $v = 'both';
                if ($k === 'theme') $v = vq_theme_class($v);
                if ($k === 'title' && $v === '') $v = 'VOCO Viktoriin';
                $st->execute([$k, $v]);
            }
            return ['ok' => true];
        case 'admin_q_save':
            $q = vq_q_sanitize(isset($in['q']) ? (array)$in['q'] : []);
            if ($id) {
                $db->prepare("UPDATE questions SET mode=?, text=?, options=?, answer=?, extra=?, image=?, time_limit=?, points=?, active=? WHERE id=?")
                   ->execute([$q['mode'], $q['text'], json_encode($q['options'], JSON_UNESCAPED_UNICODE), json_encode($q['answer'], JSON_UNESCAPED_UNICODE),
                              json_encode($q['extra'], JSON_UNESCAPED_UNICODE), $q['image'], $q['time_limit'], $q['points'], $q['active'], $id]);
                return ['ok' => true, 'id' => $id];
            }
            return ['ok' => true, 'id' => vq_q_insert($db, $q)];
        case 'admin_q_delete': $db->prepare("DELETE FROM questions WHERE id = ?")->execute([$id]); return ['ok' => true];
        case 'admin_q_delete_all': $db->exec("DELETE FROM questions"); return ['ok' => true];
        case 'admin_q_toggle': $db->prepare("UPDATE questions SET active = 1 - active WHERE id = ?")->execute([$id]); return ['ok' => true];
        case 'admin_q_move':
            $ids = array_map('intval', $db->query("SELECT id FROM questions ORDER BY sort, id")->fetchAll(PDO::FETCH_COLUMN));
            $pos = array_search($id, $ids, true); $dir = (int)(isset($in['dir']) ? $in['dir'] : 0); $to = $pos + $dir;
            if ($pos !== false && $to >= 0 && $to < count($ids)) { $t = $ids[$pos]; $ids[$pos] = $ids[$to]; $ids[$to] = $t; }
            vq_tx(function ($db) use ($ids) { $st = $db->prepare("UPDATE questions SET sort = ? WHERE id = ?"); foreach ($ids as $i => $qid) $st->execute([$i + 1, $qid]); });
            return ['ok' => true];
        case 'admin_q_samples': vq_tx(function ($db) { vq_seed_samples($db); }); return ['ok' => true];
        case 'admin_q_import':
            $list = isset($in['questions']) ? $in['questions'] : null;
            if (!is_array($list)) throw new Exception('Vigane JSON – oodati küsimuste massiivi');
            $n = vq_tx(function ($db) use ($list) { $n = 0; foreach ($list as $q) { vq_q_insert($db, vq_q_sanitize((array)$q)); $n++; } return $n; });
            return ['ok' => true, 'count' => $n];
        case 'admin_p_delete':
            vq_tx(function ($db) use ($id) { $db->prepare("DELETE FROM answers WHERE pid = ?")->execute([$id]); $db->prepare("DELETE FROM participants WHERE id = ?")->execute([$id]); });
            return ['ok' => true];
        case 'admin_p_reset':
            vq_tx(function ($db) use ($id) { $db->prepare("DELETE FROM answers WHERE pid = ?")->execute([$id]); $db->prepare("UPDATE participants SET score = 0, streak = 0, best_streak = 0, correct_count = 0 WHERE id = ?")->execute([$id]); });
            return ['ok' => true];
        case 'admin_p_reset_all':
            vq_tx(function ($db) { $db->exec("DELETE FROM answers"); $db->exec("UPDATE participants SET score = 0, streak = 0, best_streak = 0, correct_count = 0"); });
            return ['ok' => true];
        case 'admin_p_clear_all':
            vq_tx(function ($db) { $db->exec("DELETE FROM answers"); $db->exec("DELETE FROM participants"); });
            return ['ok' => true];
    }
    throw new Exception('Tundmatu admin-tegevus');
}

function vq_asset($path) {
    $f = __DIR__ . '/../' . $path;
    return $path . '?v=' . (file_exists($f) ? filemtime($f) : '1');
}
