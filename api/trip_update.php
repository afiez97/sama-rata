<?php
require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';

require_post();

try {
    $body = read_json_body();
    $trip = require_trip_from_body($pdo, $body);

    $name = require_string_field($body, 'name', 1, 100);
    $currency = require_string_field($body, 'currency', 1, 8);

    $stmt = $pdo->prepare('UPDATE trips SET name = ?, currency = ? WHERE id = ?');
    $stmt->execute([$name, $currency, $trip['id']]);

    $stmt = $pdo->prepare('SELECT * FROM trips WHERE id = ?');
    $stmt->execute([$trip['id']]);
    $trip = $stmt->fetch();

    json_response(true, fetch_trip_state($pdo, $trip), 200);
} catch (PDOException $e) {
    error_log($e->getMessage());
    json_error('server_error', 'Something went wrong. Please try again.', 500);
}
