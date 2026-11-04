<?php
require_once __DIR__ . '/inc/db.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');

function vq_out($a) { echo json_encode($a, JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR); exit; }

$raw = file_get_contents('php://input');
$body = $raw ? json_decode($raw, true) : null;
$in = array_merge($_GET, $_POST, is_array($body) ? $body : []);
$action = isset($_GET['action']) ? (string)$_GET['action'] : (string)(isset($in['action']) ? $in['action'] : '');

try {
    if ($action === 'state') vq_out(vq_api_state($in));
    if ($action === 'join') vq_out(vq_api_join($in));
    if ($action === 'answer') vq_out(vq_api_answer($in));
    if (strpos($action, 'admin_') === 0) {
        vq_session();
        if (empty($_SESSION['vq_admin'])) vq_out(['ok' => false, 'auth' => false, 'error' => 'Sessioon aegus – logi uuesti sisse']);
        $csrf = isset($_SERVER['HTTP_X_CSRF']) ? (string)$_SERVER['HTTP_X_CSRF'] : '';
        if (!hash_equals(isset($_SESSION['vq_csrf']) ? (string)$_SESSION['vq_csrf'] : '', $csrf)) vq_out(['ok' => false, 'error' => 'Turvavõti ei klapi – värskenda lehte']);
        session_write_close();
        vq_out(vq_admin($action, $in));
    }
    vq_out(['ok' => false, 'error' => 'Tundmatu tegevus']);
} catch (Throwable $e) {
    vq_out(['ok' => false, 'error' => $e->getMessage()]);
}
