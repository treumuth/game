<?php
require_once __DIR__ . '/inc/db.php';
vq_session();
if (isset($_GET['logout'])) { $_SESSION = []; session_destroy(); header('Location: admin.php'); exit; }
$loginErr = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
    if (hash_equals(ADMIN_PASSWORD, (string)$_POST['password'])) {
        session_regenerate_id(true);
        $_SESSION['vq_admin'] = true;
        $_SESSION['vq_csrf'] = bin2hex(random_bytes(16));
        header('Location: admin.php'); exit;
    }
    sleep(1); $loginErr = 'Vale parool 🙈';
}
$logged = !empty($_SESSION['vq_admin']);
$title = 'VOCO Viktoriin'; $err = ''; $vqTheme = 'default'; $vqCustomCss = '';
try {
  $s = vq_settings(); $title = $s['title'];
  $vqTheme = vq_theme_class(isset($s['theme']) ? $s['theme'] : 'default');
  $vqCustomCss = isset($s['custom_css']) ? (string)$s['custom_css'] : '';
} catch (Throwable $e) { $err = $e->getMessage(); }
$title_page = $title;
?>
<!doctype html>
<html lang="et">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Admin · <?= htmlspecialchars($title) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= vq_asset('assets/style.css') ?>">
<style id="vq-custom"><?= str_replace('</', '<\/', $vqCustomCss) ?></style>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎈</text></svg>">
</head>
<body class="admin theme-<?= htmlspecialchars($vqTheme, ENT_QUOTES, 'UTF-8') ?>">
<div class="bg-bubbles"></div>
<div class="app">
<?php if ($err): ?><div class="card" style="border:3px solid var(--pink);margin-bottom:14px">⚠️ <b><?= htmlspecialchars($err) ?></b></div><?php endif; ?>
<?php if (!$logged): ?>
  <form class="card login" method="post">
    <div class="row c"><div class="mascot"><i class="eye l"></i><i class="eye r"></i><i class="blush l"></i><i class="blush r"></i><i class="mouth"></i></div></div>
    <h1 style="margin:.3em 0">Adminpaneel</h1>
    <p class="muted"><?= htmlspecialchars($title) ?></p>
    <?php if ($loginErr): ?><p class="shake" style="color:#e8505b;font-weight:600"><?= htmlspecialchars($loginErr) ?></p><?php endif; ?>
    <input type="password" name="password" placeholder="Parool" autofocus required>
    <div style="height:12px"></div>
    <button class="btn primary big" style="width:100%">🔓 Logi sisse</button>
    <p class="help" style="margin-top:14px"><a href="index.php">← Mängija leht</a> · <a href="tv.php">📺 Teleriekraan</a></p>
  </form>
<?php else: ?>
  <div class="adm-head">
    <div class="mascot sm" style="margin:-12px -16px"><i class="eye l"></i><i class="eye r"></i><i class="blush l"></i><i class="blush r"></i><i class="mouth"></i></div>
    <h1>Admin · <span id="adm-title"><?= htmlspecialchars($title) ?></span></h1>
    <div class="sp"></div>
    <a class="btn blue" href="tv.php" target="_blank">📺 Teleriekraan</a>
    <a class="btn" href="index.php" target="_blank">📱 Mängija leht</a>
    <a class="btn small" href="admin.php?logout=1">🚪 Välja</a>
  </div>
  <div class="tabs">
    <button data-tab="game" class="on">🎮 Mäng</button>
    <button data-tab="board">🏆 Live edetabel</button>
    <button data-tab="questions">❓ Küsimused</button>
    <button data-tab="settings">⚙️ Seaded</button>
  </div>
  <div class="tab on" id="tab-game"></div>
  <div class="tab" id="tab-board"></div>
  <div class="tab" id="tab-questions"></div>
  <div class="tab" id="tab-settings"></div>
  <dialog id="qdlg"></dialog>
  <dialog id="iodlg"></dialog>
  <script>window.CSRF = <?= json_encode($_SESSION['vq_csrf']) ?>;</script>
  <script src="<?= vq_asset('assets/common.js') ?>"></script>
  <script src="<?= vq_asset('assets/admin.js') ?>"></script>
<?php endif; ?>
</div>
<script>if (typeof bubbles === 'function') bubbles(10);</script>
</body>
</html>
