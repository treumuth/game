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
<body class="player theme-<?= htmlspecialchars($vqTheme, ENT_QUOTES, 'UTF-8') ?>">
<div class="bg-bubbles"></div>
<div id="app" class="app"></div>
<div id="net" class="net">📡 Ühendus katkes… proovin uuesti</div>
<?php if ($err): ?><div class="fatal">⚠️ <?= htmlspecialchars($err) ?></div><?php endif; ?>
<script>window.VQ_TITLE = <?= json_encode($title, JSON_UNESCAPED_UNICODE) ?>;</script>
<script src="<?= vq_asset('assets/common.js') ?>"></script>
<script src="<?= vq_asset('assets/player.js') ?>"></script>
</body>
</html>
