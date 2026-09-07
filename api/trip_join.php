<?php
require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';

require_post();

try {
    enforce_join_rate_limit($pdo);

    $body = read_json_body();
    $code = scalar_field($body, 'code');

    if (!valid_join_code_format($code)) {
        json_error('invalid_argument', 'Enter the 4-digit trip code.', 400);
    }

    $stmt = $pdo->prepare('SELECT * FROM trips WHERE join_code = ?');
    $stmt->execute([$code]);
    $trip = $stmt->fetch();

    if (!$trip) {
        json_error('not_found', 'No trip matches that code.', 404);
    }

    header('Cache-Control: no-store');
    json_response(true, fetch_trip_state($pdo, $trip), 200);
} catch (PDOException $e) {
    error_log($e->getMessage());
    json_error('server_error', 'Something went wrong. Please try again.', 500);
}
