<?php
require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';

const MAX_AMOUNT_CENTS = 1000000000; // RM 10,000,000 sanity ceiling

require_post();

try {
    $body = read_json_body();
    $trip = require_trip_from_body($pdo, $body);

    $description = require_string_field($body, 'description', 1, 140);
    $amountCents = require_amount_cents($body, 'amount', MAX_AMOUNT_CENTS);
    $paidByMemberId = require_int_field($body, 'paid_by_member_id');

    $stmt = $pdo->prepare('SELECT id FROM members WHERE id = ? AND trip_id = ? AND is_active = 1');
    $stmt->execute([$paidByMemberId, $trip['id']]);
    if (!$stmt->fetch()) {
        json_error('invalid_argument', 'Payer must be an active member of this trip.', 400);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO expenses (trip_id, description, amount_cents, paid_by_member_id) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([$trip['id'], $description, $amountCents, $paidByMemberId]);
    $expenseId = (int) $pdo->lastInsertId();

    $stmt = $pdo->prepare(
        'SELECT e.id, e.description, e.amount_cents, e.paid_by_member_id,
                m.name AS paid_by_name, m.is_active AS paid_by_active, e.created_at
         FROM expenses e
         JOIN members m ON m.id = e.paid_by_member_id
         WHERE e.id = ?'
    );
    $stmt->execute([$expenseId]);
    $row = $stmt->fetch();

    json_response(true, ['expense' => [
        'id' => (int) $row['id'],
        'description' => $row['description'],
        'amount_cents' => (int) $row['amount_cents'],
        'paid_by_member_id' => (int) $row['paid_by_member_id'],
        'paid_by_name' => $row['paid_by_name'],
        'paid_by_active' => (bool) $row['paid_by_active'],
        'created_at' => $row['created_at'],
    ]], 201);
} catch (PDOException $e) {
    error_log($e->getMessage());
    json_error('server_error', 'Something went wrong. Please try again.', 500);
}
