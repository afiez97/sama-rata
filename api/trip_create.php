<?php
require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';

require_post();

try {
    $body = read_json_body();

    $name = optional_string_field($body, 'name', 'My Trip', 100);
    $currency = optional_string_field($body, 'currency', 'RM', 8);

    $slug = generate_slug($pdo);

    $stmt = $pdo->prepare('INSERT INTO trips (slug, name, currency) VALUES (?, ?, ?)');
    $stmt->execute([$slug, $name, $currency]);
    $tripId = (int) $pdo->lastInsertId();

    $stmt = $pdo->prepare('SELECT * FROM trips WHERE id = ?');
    $stmt->execute([$tripId]);
    $trip = $stmt->fetch();

    json_response(true, fetch_trip_state($pdo, $trip), 201);
} catch (PDOException $e) {
    error_log($e->getMessage());
    json_error('server_error', 'Something went wrong. Please try again.', 500);
}
