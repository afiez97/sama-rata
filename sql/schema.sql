SET NAMES utf8mb4;

CREATE TABLE trips (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug       VARCHAR(16)  NOT NULL,
  join_code  CHAR(4)      NOT NULL,
  name       VARCHAR(100) NOT NULL DEFAULT 'My Trip',
  currency   VARCHAR(8)   NOT NULL DEFAULT 'RM',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_trips_slug (slug),
  UNIQUE KEY uq_trips_join_code (join_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Throttles the "join by 4-digit code" lookup: a code only has 10,000
-- possible values, so the endpoint counts recent attempts per requester
-- here and rejects once a short window's cap is hit.
CREATE TABLE join_code_attempts (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ip_hash    CHAR(64)     NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_join_code_attempts_ip_time (ip_hash, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE members (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  trip_id    INT UNSIGNED NOT NULL,
  name       VARCHAR(60)  NOT NULL,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_members_trip_active (trip_id, is_active),
  CONSTRAINT fk_members_trip FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE expenses (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  trip_id           INT UNSIGNED NOT NULL,
  description       VARCHAR(140) NOT NULL,
  amount_cents      INT UNSIGNED NOT NULL,
  paid_by_member_id INT UNSIGNED NOT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expenses_trip_created (trip_id, created_at),
  CONSTRAINT fk_expenses_trip FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE,
  CONSTRAINT fk_expenses_member FOREIGN KEY (paid_by_member_id) REFERENCES members (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE expense_participants (
  expense_id INT UNSIGNED NOT NULL,
  member_id  INT UNSIGNED NOT NULL,
  PRIMARY KEY (expense_id, member_id),
  KEY idx_expense_participants_member (member_id),
  CONSTRAINT fk_expense_participants_expense FOREIGN KEY (expense_id) REFERENCES expenses (id) ON DELETE CASCADE,
  CONSTRAINT fk_expense_participants_member FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
