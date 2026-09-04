-- Adds per-expense participant selection ("who needs to pay for this expense").
-- Run this once against your existing Sama Rata database:
--   mysql -u your_user -p your_db < sql/migrations/001_add_expense_participants.sql
--
-- Backfills every existing expense's participants to match the OLD behavior
-- (split among everyone currently active in the trip, plus anyone who has
-- ever paid for something in it), so Settle Up totals are unchanged right
-- after migrating. Expenses added after this point use whatever the person
-- adding them ticks.

CREATE TABLE expense_participants (
  expense_id INT UNSIGNED NOT NULL,
  member_id  INT UNSIGNED NOT NULL,
  PRIMARY KEY (expense_id, member_id),
  KEY idx_expense_participants_member (member_id),
  CONSTRAINT fk_expense_participants_expense FOREIGN KEY (expense_id) REFERENCES expenses (id) ON DELETE CASCADE,
  CONSTRAINT fk_expense_participants_member FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO expense_participants (expense_id, member_id)
SELECT e.id, m.id
FROM expenses e
JOIN members m ON m.trip_id = e.trip_id
WHERE m.is_active = 1
   OR EXISTS (
        SELECT 1 FROM expenses e2
        WHERE e2.trip_id = m.trip_id AND e2.paid_by_member_id = m.id
      );
