<?php

function json_response(bool $success, array $payload, int $httpStatus = 200): void {
    http_response_code($httpStatus);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($success
        ? ['success' => true, 'data' => $payload]
        : ['success' => false, 'error' => $payload]
    );
    exit;
}

function json_error(string $code, string $message, int $httpStatus): void {
    json_response(false, ['code' => $code, 'message' => $message], $httpStatus);
}

function require_post(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_error('method_not_allowed', 'This endpoint requires POST.', 405);
    }
}

function read_json_body(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode((string) $raw, true);
    return is_array($data) ? $data : [];
}

function valid_slug_format(string $slug): bool {
    return (bool) preg_match('/^[a-f0-9]{6,16}$/', $slug);
}

function generate_slug(PDO $pdo): string {
    for ($i = 0; $i < 5; $i++) {
        $slug = bin2hex(random_bytes(5));
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM trips WHERE slug = ?');
        $stmt->execute([$slug]);
        if ((int) $stmt->fetchColumn() === 0) {
            return $slug;
        }
    }
    json_error('slug_generation_failed', 'Could not create a trip link, please try again.', 500);
}

function valid_join_code_format(string $code): bool {
    return (bool) preg_match('/^[0-9]{4}$/', $code);
}

/** Random 4-digit join code (0000-9999), re-rolled on the rare collision. */
function generate_join_code(PDO $pdo): string {
    for ($i = 0; $i < 5; $i++) {
        $code = str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM trips WHERE join_code = ?');
        $stmt->execute([$code]);
        if ((int) $stmt->fetchColumn() === 0) {
            return $code;
        }
    }
    json_error('code_generation_failed', 'Could not create a trip code, please try again.', 500);
}

// A 4-digit code only has 10,000 possible values, so the join-by-code
// endpoint throttles lookups per requester rather than relying on the
// code space alone. Window/cap are generous for a group of friends
// retyping a code, but cheap for a scanner to blow through in seconds.
const JOIN_CODE_RATE_LIMIT_WINDOW_MINUTES = 5;
const JOIN_CODE_RATE_LIMIT_MAX_ATTEMPTS = 15;

/** Rejects with 429 once too many join-code lookups have come from this requester recently; otherwise logs this attempt. */
function enforce_join_rate_limit(PDO $pdo): void {
    $ipHash = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? '');

    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM join_code_attempts
         WHERE ip_hash = ? AND created_at > (NOW() - INTERVAL ? MINUTE)'
    );
    $stmt->execute([$ipHash, JOIN_CODE_RATE_LIMIT_WINDOW_MINUTES]);
    if ((int) $stmt->fetchColumn() >= JOIN_CODE_RATE_LIMIT_MAX_ATTEMPTS) {
        json_error('rate_limited', 'Too many attempts. Please wait a few minutes and try again.', 429);
    }

    $stmt = $pdo->prepare('INSERT INTO join_code_attempts (ip_hash) VALUES (?)');
    $stmt->execute([$ipHash]);

    // Opportunistic cleanup so the table doesn't grow forever — no cron needed.
    if (random_int(1, 100) === 1) {
        $pdo->exec('DELETE FROM join_code_attempts WHERE created_at < (NOW() - INTERVAL 1 HOUR)');
    }
}

/** Returns the trip row for an already-format-validated slug, or null if unknown. */
function resolve_trip(PDO $pdo, string $slug): ?array {
    $stmt = $pdo->prepare('SELECT * FROM trips WHERE slug = ?');
    $stmt->execute([$slug]);
    $trip = $stmt->fetch();
    return $trip ?: null;
}

/** 400 for a missing/malformed slug, 404 for a well-formed slug that doesn't exist. */
function require_trip(PDO $pdo, string $slug): array {
    if (!valid_slug_format($slug)) {
        json_error('invalid_argument', 'A valid trip link is required.', 400);
    }
    $trip = resolve_trip($pdo, $slug);
    if (!$trip) {
        json_error('not_found', 'Trip not found.', 404);
    }
    return $trip;
}

/** Safely extracts and validates the trip for a JSON POST body's "slug" field. */
function require_trip_from_body(PDO $pdo, array $body): array {
    return require_trip($pdo, scalar_field($body, 'slug'));
}

/** Returns a trimmed string for a scalar body value, or '' for a missing/non-scalar one. */
function scalar_field(array $body, string $field): string {
    $raw = $body[$field] ?? '';
    return is_scalar($raw) ? trim((string) $raw) : '';
}

/** Trims a required string field from the request body, enforcing min/max length. Rejects non-scalar values (e.g. a JSON array/object) with 400 rather than silently coercing them. */
function require_string_field(array $body, string $field, int $minLen, int $maxLen): string {
    $raw = $body[$field] ?? '';
    if (!is_scalar($raw)) {
        json_error('invalid_argument', "\"$field\" must be a string.", 400);
    }
    $value = trim((string) $raw);
    $len = mb_strlen($value);
    if ($len < $minLen || $len > $maxLen) {
        json_error('invalid_argument', "\"$field\" must be between $minLen and $maxLen characters.", 400);
    }
    return $value;
}

/** Trims an optional string field, defaulting to $default when absent/empty. Rejects a non-scalar value (e.g. a JSON array/object) with 400. */
function optional_string_field(array $body, string $field, string $default, int $maxLen): string {
    $raw = $body[$field] ?? '';
    if (!is_scalar($raw)) {
        json_error('invalid_argument', "\"$field\" must be a string.", 400);
    }
    $value = trim((string) $raw);
    if ($value === '') {
        return $default;
    }
    if (mb_strlen($value) > $maxLen) {
        json_error('invalid_argument', "\"$field\" must be $maxLen characters or fewer.", 400);
    }
    return $value;
}

/** Parses a positive money amount (RM, up to 2 decimals) into integer cents. */
function require_amount_cents(array $body, string $field, int $maxCents): int {
    $raw = $body[$field] ?? null;
    if (!is_numeric($raw)) {
        json_error('invalid_argument', "\"$field\" must be a number.", 400);
    }
    $amount = (float) $raw;
    if ($amount <= 0) {
        json_error('invalid_argument', "\"$field\" must be greater than zero.", 400);
    }
    $cents = (int) round($amount * 100);
    if (abs($cents - $amount * 100) > 0.001) {
        json_error('invalid_argument', "\"$field\" cannot have more than 2 decimal places.", 400);
    }
    if ($cents > $maxCents) {
        json_error('invalid_argument', "\"$field\" is too large.", 400);
    }
    return $cents;
}

function require_int_field(array $body, string $field): int {
    $raw = $body[$field] ?? null;
    if (!is_numeric($raw) || (int) $raw != $raw) {
        json_error('invalid_argument', "\"$field\" must be a whole number.", 400);
    }
    return (int) $raw;
}

/** Validates a JSON array of whole numbers, returns unique ints. Rejects a non-array, an object, or a non-numeric/non-integer entry with 400. */
function require_id_array(array $body, string $field): array {
    $raw = $body[$field] ?? null;
    if (!is_array($raw) || !array_is_list($raw) || $raw === []) {
        json_error('invalid_argument', "\"$field\" must be a non-empty array of whole numbers.", 400);
    }
    $ids = [];
    foreach ($raw as $value) {
        if (!is_numeric($value) || (int) $value != $value) {
            json_error('invalid_argument', "\"$field\" must contain whole numbers.", 400);
        }
        $ids[(int) $value] = true;
    }
    return array_keys($ids);
}

/** Returns [expense_id => [{id, name, is_active}, ...]] for every expense in this trip. */
function fetch_participants_by_expense(PDO $pdo, array $trip): array {
    $stmt = $pdo->prepare(
        'SELECT ep.expense_id, m.id AS member_id, m.name, m.is_active
         FROM expense_participants ep
         JOIN members m ON m.id = ep.member_id
         JOIN expenses e ON e.id = ep.expense_id
         WHERE e.trip_id = ?
         ORDER BY m.created_at ASC'
    );
    $stmt->execute([$trip['id']]);

    $byExpense = [];
    foreach ($stmt->fetchAll() as $row) {
        $byExpense[$row['expense_id']][] = [
            'id' => (int) $row['member_id'],
            'name' => $row['name'],
            'is_active' => (bool) $row['is_active'],
        ];
    }
    return $byExpense;
}

/** Fetches full trip state: trip row, all members, expenses (newest first) with payer name/status and participants. */
function fetch_trip_state(PDO $pdo, array $trip): array {
    $stmt = $pdo->prepare('SELECT id, name, is_active FROM members WHERE trip_id = ? ORDER BY created_at ASC');
    $stmt->execute([$trip['id']]);
    $members = $stmt->fetchAll();

    $stmt = $pdo->prepare(
        'SELECT e.id, e.description, e.amount_cents, e.paid_by_member_id,
                m.name AS paid_by_name, m.is_active AS paid_by_active, e.created_at
         FROM expenses e
         JOIN members m ON m.id = e.paid_by_member_id
         WHERE e.trip_id = ?
         ORDER BY e.created_at DESC, e.id DESC'
    );
    $stmt->execute([$trip['id']]);
    $expenses = $stmt->fetchAll();

    $participantsByExpense = fetch_participants_by_expense($pdo, $trip);

    return [
        'trip' => [
            'slug' => $trip['slug'],
            'join_code' => $trip['join_code'],
            'name' => $trip['name'],
            'currency' => $trip['currency'],
            'created_at' => $trip['created_at'],
        ],
        'members' => array_map(fn($m) => [
            'id' => (int) $m['id'],
            'name' => $m['name'],
            'is_active' => (bool) $m['is_active'],
        ], $members),
        'expenses' => array_map(fn($e) => [
            'id' => (int) $e['id'],
            'description' => $e['description'],
            'amount_cents' => (int) $e['amount_cents'],
            'paid_by_member_id' => (int) $e['paid_by_member_id'],
            'paid_by_name' => $e['paid_by_name'],
            'paid_by_active' => (bool) $e['paid_by_active'],
            'created_at' => $e['created_at'],
            'participants' => $participantsByExpense[$e['id']] ?? [],
        ], $expenses),
    ];
}
