<?php
require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';

require_post();

try {
    $body = read_json_body();
    $trip = require_trip_from_body($pdo, $body);

    $name = require_string_field($body, 'name', 1, 60);

    // members.name uses utf8mb4_unicode_ci, which already compares case-insensitively.
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM members WHERE trip_id = ? AND is_active = 1 AND name = ?');
    $stmt->execute([$trip['id'], $name]);
    if ((int) $stmt->fetchColumn() > 0) {
        json_error('duplicate_member', 'A member with this name is already on the trip.', 409);
    }

    $stmt = $pdo->prepare('INSERT INTO members (trip_id, name) VALUES (?, ?)');
    $stmt->execute([$trip['id'], $name]);
    $memberId = (int) $pdo->lastInsertId();

    json_response(true, ['member' => ['id' => $memberId, 'name' => $name, 'is_active' => true]], 201);
} catch (PDOException $e) {
    error_log($e->getMessage());
    json_error('server_error', 'Something went wrong. Please try again.', 500);
}
