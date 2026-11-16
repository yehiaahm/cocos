-- Workshops shown in the "Let's get creative" section of the homepage, managed from the dashboard.
-- The four workshops built into the site (src/data/workshops.ts) are only the starting point: the first dashboard
-- request copies them into this table (server/workshops.ts → ensureSeeded). From then on the dashboard is the source
-- of truth; the shop starts using the table as soon as the owner changes anything (settings.workshops_rev > 0).
-- Apply locally:  npx wrangler d1 migrations apply cocos-art --local
-- Apply to prod:  npx wrangler d1 migrations apply cocos-art --remote   (Railway applies it on start)

CREATE TABLE IF NOT EXISTS workshops (
  id           TEXT PRIMARY KEY,                       -- resin, candles … (tab id on the shop; never changes after creation)
  name         TEXT NOT NULL,                          -- English name: tab label and heading
  name_ar      TEXT NOT NULL DEFAULT '',               -- Arabic accent label above the heading
  tag          TEXT NOT NULL DEFAULT '',               -- small badge on the photo ("Most popular")
  image        TEXT NOT NULL,                          -- photo (shipped with the site or uploaded: /media/catalog/…)
  alt          TEXT NOT NULL DEFAULT '',               -- photo description for screen readers; empty = the name
  description  TEXT NOT NULL DEFAULT '',
  day1         TEXT NOT NULL DEFAULT '',               -- what happens on day 1
  day2         TEXT NOT NULL DEFAULT '',               -- what happens on day 2; empty = a one-session workshop
  price        INTEGER,                                -- EGP per seat; NULL = "ask us"
  dates        TEXT NOT NULL DEFAULT '',               -- free text: "Saturdays · 5 pm", "Next: 12 & 19 Dec"
  active       INTEGER NOT NULL DEFAULT 1,             -- 0 = hidden from the shop
  sort_order   INTEGER NOT NULL DEFAULT 0,             -- ascending
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
