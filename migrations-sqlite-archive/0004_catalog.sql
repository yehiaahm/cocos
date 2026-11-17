-- The product catalogue and its categories, managed from the dashboard.
-- data/products.json is only the starting point: the first request after this migration copies it into these
-- tables (server/catalog.ts → ensureSeeded). From then on the dashboard is the source of truth.
-- Price / hidden / sold-out stay in product_overrides, keyed by the same product id.
-- Apply locally:  npx wrangler d1 migrations apply cocos-art --local
-- Apply to prod:  npx wrangler d1 migrations apply cocos-art --remote   (Railway applies it on start)

CREATE TABLE IF NOT EXISTS catalog_categories (
  slug         TEXT PRIMARY KEY,                       -- used in URLs: /shop/<slug>; never changes after creation
  name         TEXT NOT NULL,                          -- English name shown on the shop
  name_ar      TEXT NOT NULL DEFAULT '',               -- Arabic name (dashboard in Arabic, homepage accent label)
  description  TEXT NOT NULL DEFAULT '',               -- one or two sentences under the shop heading
  sort_order   INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS catalog_products (
  id           TEXT PRIMARY KEY,                       -- coco-001 …; order_items.product_id points here
  slug         TEXT NOT NULL UNIQUE,                   -- used in URLs: /product/<slug>
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL,                          -- catalog_categories.slug
  tags         TEXT NOT NULL DEFAULT '[]',             -- JSON: occasion slugs (ramadan, halloween, christmas, personalised)
  image        TEXT NOT NULL,                          -- cover photo (one of the variants' images)
  variants     TEXT NOT NULL DEFAULT '[]',             -- JSON: [{ catalogId, name, material, images: [] }]
  sort_order   INTEGER NOT NULL DEFAULT 0,             -- ascending; new products get a lower number than all others (shown first)
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_catalog_products_category ON catalog_products(category);
