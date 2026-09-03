<?php
require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';

require_post();

try {
    $body = read_json_body();
    $trip = require_trip_from_body($pdo, $body);

    $pdo->beginTransaction();
    $stmt = $pdo->prepare('DELETE FROM expenses WHERE trip_id = ?');
    $stmt->execute([$trip['id']]);
    $stmt = $pdo->prepare('DELETE FROM members WHERE trip_id = ?');
    $stmt->execute([$trip['id']]);
    $pdo->commit();

    json_response(true, fetch_trip_state($pdo, $trip), 200);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log($e->getMessage());
    json_error('server_error', 'Something went wrong. Please try again.', 500);
}
