<?php
require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';

require_post();

try {
    $body = read_json_body();
    $trip = require_trip_from_body($pdo, $body);

    $memberId = require_int_field($body, 'member_id');

    $stmt = $pdo->prepare('SELECT id FROM members WHERE id = ? AND trip_id = ?');
    $stmt->execute([$memberId, $trip['id']]);
    if (!$stmt->fetch()) {
        json_error('not_found', 'Member not found.', 404);
    }

    $stmt = $pdo->prepare('UPDATE members SET is_active = 0 WHERE id = ? AND trip_id = ?');
    $stmt->execute([$memberId, $trip['id']]);

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM expenses WHERE paid_by_member_id = ? AND trip_id = ?');
    $stmt->execute([$memberId, $trip['id']]);
    $expenseCount = (int) $stmt->fetchColumn();

    json_response(true, ['member_id' => $memberId, 'expense_count_retained' => $expenseCount], 200);
} catch (PDOException $e) {
    error_log($e->getMessage());
    json_error('server_error', 'Something went wrong. Please try again.', 500);
}
