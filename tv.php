<?php
require_once __DIR__ . '/inc/db.php';
$title = 'VOCO Viktoriin'; $err = ''; $vqTheme = 'default'; $vqCustomCss = '';
try {
  $s = vq_settings(); $title = $s['title'];
  $vqTheme = vq_theme_class(isset($s['theme']) ? $s['theme'] : 'default');
  $vqCustomCss = isset($s['custom_css']) ? (string)$s['custom_css'] : '';
} catch (Throwable $e) { $err = $e->getMessage(); }
?>
<!doctype html>
<html lang="et">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title><?= htmlspecialchars($title) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= vq_asset('assets/style.css') ?>">
<style id="vq-custom"><?= str_replace('</', '<\/', $vqCustomCss) ?></style>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎈</text></svg>">
</head>
<body class="tv theme-<?= htmlspecialchars($vqTheme, ENT_QUOTES, 'UTF-8') ?>">
<div class="bg-bubbles"></div>
<div class="tv-wrap">
  <div class="tv-head">
    <div class="mascot sm" style="margin:-10px -14px"><i class="eye l"></i><i class="eye r"></i><i class="blush l"></i><i class="blush r"></i><i class="mouth"></i></div>
    <h1 id="tv-title"><?= htmlspecialchars($title) ?></h1>
    <span class="pill" id="tv-status">⏳ Laen…</span>
    <div class="sp"></div>
    <span class="pill" id="tv-count">👥 0</span>
    <div class="tv-tools">
      <button class="btn small" id="btn-sound" title="Heli">🔊</button>
      <button class="btn small" id="btn-fs" title="Täisekraan">⛶</button>
    </div>
  </div>
  <div class="stage" id="stage"></div>
</div>
<div class="sound-gate" id="gate"><div class="card">
  <div class="big-emoji">📺</div>
  <h2 style="margin:.4em 0">Teleriekraan</h2>
  <p>Klõpsa, et lubada helid ja minna täisekraanile.</p>
  <div class="row c"><button class="btn primary big" id="gate-go">▶ Alusta</button><button class="btn big" id="gate-mute">🔇 Ilma helita</button></div>
</div></div>
<div id="net" class="net">📡 Ühendus serveriga katkes…</div>
<?php if ($err): ?><div class="fatal">⚠️ <?= htmlspecialchars($err) ?></div><?php endif; ?>
<script src="<?= vq_asset('assets/common.js') ?>"></script>
<script src="<?= vq_asset('assets/tv.js') ?>"></script>
</body>
</html>
