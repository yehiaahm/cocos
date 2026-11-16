-- Promo codes (offers) managed from the dashboard, and the discount each order received.
-- Apply locally:  npx wrangler d1 migrations apply cocos-art --local
-- Apply to prod:  npx wrangler d1 migrations apply cocos-art --remote   (Railway applies it on start)

CREATE TABLE IF NOT EXISTS promo_codes (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  code                TEXT NOT NULL UNIQUE,              -- always upper-case, A-Z 0-9 - _
  type                TEXT NOT NULL,                     -- percent | fixed | free_shipping
  value               INTEGER NOT NULL DEFAULT 0,        -- percent: 1-100 · fixed: EGP · free_shipping: unused (0)
  min_subtotal        INTEGER,                           -- EGP; NULL = no minimum order
  max_discount        INTEGER,                           -- EGP cap for percent codes; NULL = no cap
  starts_at           TEXT,                              -- ISO UTC; NULL = from now
  ends_at             TEXT,                              -- ISO UTC; NULL = no end date
  usage_limit         INTEGER,                           -- total orders that may use it; NULL = unlimited
  per_customer_limit  INTEGER,                           -- orders per phone number; NULL = unlimited
  used_count          INTEGER NOT NULL DEFAULT 0,        -- non-cancelled orders that used it
  active              INTEGER NOT NULL DEFAULT 1,        -- paused codes are refused at checkout
  banner              INTEGER NOT NULL DEFAULT 0,        -- 1 = announced in the bar at the top of the shop (one code at a time)
  banner_text         TEXT NOT NULL DEFAULT '',          -- custom announcement; empty = generated from the rules
  note                TEXT NOT NULL DEFAULT '',          -- internal note for the owner
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- The order keeps its own copy of the rules (JSON), so editing or deleting a code never changes past orders.
ALTER TABLE orders ADD COLUMN promo_id INTEGER;
ALTER TABLE orders ADD COLUMN promo_code TEXT;
ALTER TABLE orders ADD COLUMN promo TEXT;                -- JSON: { type, value, minSubtotal, maxDiscount }
ALTER TABLE orders ADD COLUMN discount INTEGER;          -- EGP; NULL while it can't be worked out yet (unpriced items)
CREATE INDEX IF NOT EXISTS idx_orders_promo ON orders(promo_id);
