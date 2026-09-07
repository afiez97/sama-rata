-- Adds a 4-digit "join code" as a quick manual/QR entry alongside the
-- existing share link, plus a table to rate-limit code lookups (a 4-digit
-- code only has 10,000 possible values, so the join endpoint needs to
-- throttle guesses). Run this once against your existing Sama Rata database:
--   mysql -u your_user -p your_db < sql/migrations/002_add_join_code.sql
--
-- Existing trips are backfilled with a random 4-digit code. Collisions
-- across a handful of existing trips are very unlikely, but the final
-- ALTER will fail with a duplicate-key error if one occurs — if that
-- happens, manually update the clashing row(s) and re-run the last
-- statement.

ALTER TABLE trips ADD COLUMN join_code CHAR(4) NULL AFTER slug;

UPDATE trips SET join_code = LPAD(FLOOR(RAND() * 10000), 4, '0') WHERE join_code IS NULL;

ALTER TABLE trips
  MODIFY COLUMN join_code CHAR(4) NOT NULL,
  ADD UNIQUE KEY uq_trips_join_code (join_code);

CREATE TABLE join_code_attempts (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ip_hash    CHAR(64)     NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_join_code_attempts_ip_time (ip_hash, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
