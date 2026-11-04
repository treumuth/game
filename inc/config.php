<?php
// ===== VOCO Viktoriin – põhiseaded =====
// Adminpaneeli parool (muuda soovi korral siin)
define('ADMIN_PASSWORD', getenv('VQ_ADMIN_PASSWORD') ?: 'voco2026');
// Andmebaasi asukoht (kaust peab olema veebiserverile kirjutatav)
define('DATA_DIR', __DIR__ . '/../data');
define('DB_FILE', DATA_DIR . '/viktoriin.sqlite');
date_default_timezone_set('Europe/Tallinn');
