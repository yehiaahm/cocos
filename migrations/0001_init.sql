-- Coco's Resin Art — orders, products, customers (derived), notifications.
-- Apply locally:  npx wrangler d1 migrations apply cocos-art --local
-- Apply to prod:  npx wrangler d1 migrations apply cocos-art --remote

CREATE TABLE IF NOT EXISTS orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  number          TEXT UNIQUE,                       -- CA-1001
  token           TEXT NOT NULL UNIQUE,              -- secret for the customer's order page
  status          TEXT NOT NULL DEFAULT 'new',       -- new | confirmed | in_progress | shipped | delivered | cancelled
  payment_method  TEXT NOT NULL,                     -- cod | instapay | wallet
  payment_status  TEXT NOT NULL DEFAULT 'unpaid',    -- unpaid | pending_review | paid | refunded
  proof_key       TEXT,                              -- R2 key of the transfer screenshot
  customer_name   TEXT NOT NULL,
  phone           TEXT NOT NULL,                     -- normalised 01xxxxxxxxx
  city            TEXT NOT NULL,
  address         TEXT NOT NULL,
  notes           TEXT,
  subtotal        INTEGER,                           -- EGP; NULL while any item is unpriced
  delivery_fee    INTEGER,
  total           INTEGER,
  admin_notes     TEXT,
  ip_hash         TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);

CREATE TABLE IF NOT EXISTS order_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id       TEXT NOT NULL,
  variant_id       TEXT NOT NULL,
  name             TEXT NOT NULL,
  variant_name     TEXT,
  image            TEXT,
  qty              INTEGER NOT NULL,
  personalisation  TEXT,
  unit_price       INTEGER                            -- EGP; NULL = to be confirmed
);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_items_product ON order_items(product_id);

CREATE TABLE IF NOT EXISTS order_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,                          -- created | status | payment | pricing | note | proof
  message     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_events_order ON order_events(order_id);

-- Price / visibility / stock set from the dashboard, layered over data/products.json.
CREATE TABLE IF NOT EXISTS product_overrides (
  product_id  TEXT PRIMARY KEY,
  price       INTEGER,
  hidden      INTEGER NOT NULL DEFAULT 0,
  sold_out    INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint    TEXT PRIMARY KEY,
  p256dh      TEXT,
  auth        TEXT,
  user_agent  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- What the phone notification shows (the push itself carries no data).
CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  url         TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket      TEXT NOT NULL,                          -- e.g. order:<iphash>, login:<iphash>
  created_at  INTEGER NOT NULL                        -- unix seconds
);
CREATE INDEX IF NOT EXISTS idx_rate_bucket ON rate_limits(bucket, created_at);
