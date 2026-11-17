-- Coco's Resin Art — full MySQL schema (MySQL 8.0.19+; Railway's MySQL plugin is 8.x).
--
-- This replaces the nine SQLite migrations that used to live in migrations-sqlite-archive/ (kept for reference only).
--
-- RULES FOR MIGRATIONS (MySQL cannot roll back DDL — a failed migration may be half-applied):
--   * every statement must be safe to run twice (CREATE TABLE IF NOT EXISTS …, INSERT IGNORE …);
--     for ALTER TABLE, add the column in its own new migration file, once, and never edit a released file;
--   * statements are separated by a semicolon at the end of a line.
--
-- Conventions: timestamps are ISO-8601 UTC strings ("2026-11-17T19:03:20.749Z", sortable as text) exactly as before;
-- unix-seconds columns are BIGINT; "boolean" columns are TINYINT 0/1; ids are INT AUTO_INCREMENT.
-- Secrets (tokens, hashes, push endpoints) use binary / ascii_bin collations so they compare case-sensitively;
-- everything else uses the server default (case- and accent-insensitive), which also makes dashboard search forgiving.

-- Customer accounts: email + password and/or "Continue with Google".
CREATE TABLE IF NOT EXISTS users (
  id              INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email           VARCHAR(254) NOT NULL,                         -- always lower-case
  email_verified  TINYINT NOT NULL DEFAULT 0,                    -- 1 once Google has confirmed the address
  name            VARCHAR(255) NOT NULL,
  password_hash   VARCHAR(512) NULL,                             -- pbkdf2$<iterations>$<salt>$<hash>; NULL = Google-only
  google_sub      VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,       -- Google account id
  avatar_url      VARCHAR(1000) NULL,
  phone           VARCHAR(32) NULL,
  city            VARCHAR(255) NULL,
  address         TEXT NULL,
  created_at      VARCHAR(32) NOT NULL DEFAULT (CONCAT(SUBSTRING(DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%f'), 1, 23), 'Z')),
  last_login_at   VARCHAR(32) NULL,
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_google (google_sub)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Only a hash of each session token is stored, so a leaked database can't be used to sign in.
CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash  VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  user_id     INT NOT NULL,
  expires_at  BIGINT NOT NULL,                                   -- unix seconds
  created_at  VARCHAR(32) NOT NULL DEFAULT (CONCAT(SUBSTRING(DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%f'), 1, 23), 'Z')),
  KEY idx_user_sessions_user (user_id),
  CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id              INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  number          VARCHAR(32) NULL,                              -- CA-1001
  token           VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,   -- secret for the customer's order page
  status          VARCHAR(32) NOT NULL DEFAULT 'new',            -- new | confirmed | in_progress | shipped | delivered | cancelled
  payment_method  VARCHAR(32) NOT NULL,                          -- cod | instapay | wallet
  payment_status  VARCHAR(32) NOT NULL DEFAULT 'unpaid',         -- unpaid | pending_review | paid | refunded
  proof_key       VARCHAR(255) NULL,                             -- upload key of the transfer screenshot
  customer_name   VARCHAR(255) NOT NULL,
  phone           VARCHAR(32) NOT NULL,                          -- normalised 01xxxxxxxxx
  city            VARCHAR(255) NOT NULL,
  address         TEXT NOT NULL,
  notes           TEXT NULL,
  subtotal        INT NULL,                                      -- EGP; NULL while any item is unpriced
  delivery_fee    INT NULL,
  total           INT NULL,
  admin_notes     TEXT NULL,
  ip_hash         VARCHAR(128) NULL,
  created_at      VARCHAR(32) NOT NULL DEFAULT (CONCAT(SUBSTRING(DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%f'), 1, 23), 'Z')),
  updated_at      VARCHAR(32) NOT NULL DEFAULT (CONCAT(SUBSTRING(DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%f'), 1, 23), 'Z')),
  user_id         INT NULL,                                      -- orders placed while signed in belong to the account
  promo_id        INT NULL,
  promo_code      VARCHAR(64) NULL,
  promo           TEXT NULL,                                     -- JSON: { type, value, minSubtotal, maxDiscount }
  discount        INT NULL,                                      -- EGP; NULL while it can't be worked out yet (unpriced items)
  courier         VARCHAR(255) NULL,
  tracking_number VARCHAR(255) NULL,
  UNIQUE KEY uq_orders_number (number),
  UNIQUE KEY uq_orders_token (token),
  KEY idx_orders_created (created_at),
  KEY idx_orders_status (status),
  KEY idx_orders_phone (phone),
  KEY idx_orders_user (user_id),
  KEY idx_orders_promo (promo_id),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
  id               INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id         INT NOT NULL,
  product_id       VARCHAR(64) NOT NULL,
  variant_id       VARCHAR(64) NOT NULL,
  name             VARCHAR(500) NOT NULL,
  variant_name     VARCHAR(500) NULL,
  image            VARCHAR(500) NULL,
  qty              INT NOT NULL,
  personalisation  VARCHAR(500) NULL,
  unit_price       INT NULL,                                     -- EGP; NULL = to be confirmed
  KEY idx_items_order (order_id),
  KEY idx_items_product (product_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_events (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id    INT NOT NULL,
  type        VARCHAR(32) NOT NULL,                              -- created | status | payment | pricing | note | proof | tracking
  message     TEXT NOT NULL,
  created_at  VARCHAR(32) NOT NULL DEFAULT (CONCAT(SUBSTRING(DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%f'), 1, 23), 'Z')),
  status      VARCHAR(32) NULL,                                  -- the status this event moved the order to
  KEY idx_events_order (order_id),
  CONSTRAINT fk_events_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Price / visibility / stock set from the dashboard.
-- stock: NULL = not tracked; a number is tracked (orders subtract, cancelling gives back, 0 = sold out).
CREATE TABLE IF NOT EXISTS product_overrides (
  product_id  VARCHAR(64) NOT NULL PRIMARY KEY,
  price       INT NULL,
  hidden      TINYINT NOT NULL DEFAULT 0,
  sold_out    TINYINT NOT NULL DEFAULT 0,
  updated_at  VARCHAR(32) NOT NULL DEFAULT (CONCAT(SUBSTRING(DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%f'), 1, 23), 'Z')),
  stock       INT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- `key` is a reserved word in MySQL: always write `key` in backticks.
CREATE TABLE IF NOT EXISTS settings (
  `key`    VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  `value`  TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint    VARCHAR(1000) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  p256dh      VARCHAR(255) NULL,
  auth        VARCHAR(255) NULL,
  user_agent  VARCHAR(500) NULL,
  created_at  VARCHAR(32) NOT NULL DEFAULT (CONCAT(SUBSTRING(DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%f'), 1, 23), 'Z'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- What the phone notification shows (the push itself carries no data).
CREATE TABLE IF NOT EXISTS notifications (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(500) NOT NULL,
  body        TEXT NOT NULL,
  url         VARCHAR(500) NOT NULL,
  created_at  VARCHAR(32) NOT NULL DEFAULT (CONCAT(SUBSTRING(DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%f'), 1, 23), 'Z'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket      VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,    -- e.g. order:<iphash>, login:<iphash>
  created_at  BIGINT NOT NULL,                                                -- unix seconds
  KEY idx_rate_bucket (bucket, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Server-side admin (dashboard) sessions, so sign-out and "sign out everywhere" really revoke access.
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash    VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,   -- sha256 of the cookie value
  fingerprint   VARCHAR(255) NOT NULL,                           -- changes when ADMIN_EMAIL / ADMIN_PASSWORD change
  created_at    BIGINT NOT NULL,                                 -- unix seconds
  expires_at    BIGINT NOT NULL,                                 -- absolute lifetime
  last_seen_at  BIGINT NOT NULL,                                 -- idle timeout is measured from here
  ip_hash       VARCHAR(128) NULL,                               -- salted hash, never the raw IP
  user_agent    VARCHAR(500) NULL,
  KEY idx_admin_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- The product catalogue and its categories, managed from the dashboard (data/products.json is only the starting point:
-- server/catalog.ts → ensureSeeded copies it in on the first request).
CREATE TABLE IF NOT EXISTS catalog_categories (
  slug         VARCHAR(100) NOT NULL PRIMARY KEY,                -- used in URLs: /shop/<slug>; never changes after creation
  name         VARCHAR(255) NOT NULL,
  name_ar      VARCHAR(255) NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT (''),
  sort_order   INT NOT NULL DEFAULT 0,
  updated_at   VARCHAR(32) NOT NULL DEFAULT (CONCAT(SUBSTRING(DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%f'), 1, 23), 'Z'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS catalog_products (
  id           VARCHAR(64) NOT NULL PRIMARY KEY,                 -- coco-001 …; order_items.product_id points here
  slug         VARCHAR(191) NOT NULL,                            -- used in URLs: /product/<slug>
  name         VARCHAR(500) NOT NULL,
  description  TEXT NOT NULL DEFAULT (''),
  category     VARCHAR(100) NOT NULL,                            -- catalog_categories.slug
  tags         TEXT NOT NULL DEFAULT ('[]'),                     -- JSON: occasion slugs
  image        VARCHAR(500) NOT NULL,                            -- cover photo
  variants     MEDIUMTEXT NOT NULL,                              -- JSON: [{ catalogId, name, material, images: [] }]
  sort_order   INT NOT NULL DEFAULT 0,                           -- ascending; new products get a lower number (shown first)
  created_at   VARCHAR(32) NOT NULL DEFAULT (CONCAT(SUBSTRING(DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%f'), 1, 23), 'Z')),
  updated_at   VARCHAR(32) NOT NULL DEFAULT (CONCAT(SUBSTRING(DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%f'), 1, 23), 'Z')),
  UNIQUE KEY uq_catalog_products_slug (slug),
  KEY idx_catalog_products_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Promo codes (offers) managed from the dashboard, and the discount each order received.
CREATE TABLE IF NOT EXISTS promo_codes (
  id                  INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code                VARCHAR(64) NOT NULL,                      -- always upper-case, A-Z 0-9 - _
  type                VARCHAR(32) NOT NULL,                      -- percent | fixed | free_shipping
  value               INT NOT NULL DEFAULT 0,                    -- percent: 1-100 · fixed: EGP · free_shipping: unused (0)
  min_subtotal        INT NULL,                                  -- EGP; NULL = no minimum order
  max_discount        INT NULL,                                  -- EGP cap for percent codes; NULL = no cap
  starts_at           VARCHAR(32) NULL,                          -- ISO UTC; NULL = from now
  ends_at             VARCHAR(32) NULL,                          -- ISO UTC; NULL = no end date
  usage_limit         INT NULL,                                  -- total orders that may use it; NULL = unlimited
  per_customer_limit  INT NULL,                                  -- orders per phone number; NULL = unlimited
  used_count          INT NOT NULL DEFAULT 0,                    -- non-cancelled orders that used it
  active              TINYINT NOT NULL DEFAULT 1,                -- paused codes are refused at checkout
  banner              TINYINT NOT NULL DEFAULT 0,                -- 1 = announced in the bar at the top of the shop
  banner_text         TEXT NOT NULL DEFAULT (''),                -- custom announcement; empty = generated from the rules
  note                TEXT NOT NULL DEFAULT (''),                -- internal note for the owner
  created_at          VARCHAR(32) NOT NULL DEFAULT (CONCAT(SUBSTRING(DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%f'), 1, 23), 'Z')),
  updated_at          VARCHAR(32) NOT NULL DEFAULT (CONCAT(SUBSTRING(DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%f'), 1, 23), 'Z')),
  UNIQUE KEY uq_promo_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Workshops shown on the homepage, managed from the dashboard.
CREATE TABLE IF NOT EXISTS workshops (
  id           VARCHAR(100) NOT NULL PRIMARY KEY,                -- resin, candles … (never changes after creation)
  name         VARCHAR(255) NOT NULL,
  name_ar      VARCHAR(255) NOT NULL DEFAULT '',
  tag          VARCHAR(255) NOT NULL DEFAULT '',                 -- small badge on the photo ("Most popular")
  image        VARCHAR(500) NOT NULL,
  alt          VARCHAR(500) NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT (''),
  day1         TEXT NOT NULL DEFAULT (''),
  day2         TEXT NOT NULL DEFAULT (''),
  price        INT NULL,                                         -- EGP per seat; NULL = "ask us"
  dates        VARCHAR(500) NOT NULL DEFAULT '',
  active       TINYINT NOT NULL DEFAULT 1,                       -- 0 = hidden from the shop
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   VARCHAR(32) NOT NULL DEFAULT (CONCAT(SUBSTRING(DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%f'), 1, 23), 'Z')),
  updated_at   VARCHAR(32) NOT NULL DEFAULT (CONCAT(SUBSTRING(DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%f'), 1, 23), 'Z'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
