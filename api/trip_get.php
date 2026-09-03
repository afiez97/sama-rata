<?php
require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error('method_not_allowed', 'This endpoint requires GET.', 405);
}

try {
    $rawSlug = $_GET['slug'] ?? '';
    $slug = is_scalar($rawSlug) ? trim((string) $rawSlug) : '';
    $trip = require_trip($pdo, $slug);

    header('Cache-Control: no-store');
    json_response(true, fetch_trip_state($pdo, $trip), 200);
} catch (PDOException $e) {
    error_log($e->getMessage());
    json_error('server_error', 'Something went wrong. Please try again.', 500);
}
