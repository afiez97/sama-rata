<?php
require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';

require_post();

try {
    $body = read_json_body();
    $trip = require_trip_from_body($pdo, $body);

    $expenseId = require_int_field($body, 'expense_id');

    $stmt = $pdo->prepare('DELETE FROM expenses WHERE id = ? AND trip_id = ?');
    $stmt->execute([$expenseId, $trip['id']]);

    if ($stmt->rowCount() === 0) {
        json_error('not_found', 'Expense not found.', 404);
    }

    json_response(true, ['expense_id' => $expenseId], 200);
} catch (PDOException $e) {
    error_log($e->getMessage());
    json_error('server_error', 'Something went wrong. Please try again.', 500);
}
