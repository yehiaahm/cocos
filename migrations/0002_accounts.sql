-- Customer accounts: email + password and/or "Continue with Google".
-- Apply locally:  npx wrangler d1 migrations apply cocos-art --local
-- Apply to prod:  npx wrangler d1 migrations apply cocos-art --remote   (Railway applies it on start)

CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT NOT NULL UNIQUE,              -- always lower-case
  email_verified  INTEGER NOT NULL DEFAULT 0,        -- 1 once Google has confirmed the address
  name            TEXT NOT NULL,
  password_hash   TEXT,                              -- pbkdf2$<iterations>$<salt>$<hash>; NULL = Google-only
  google_sub      TEXT UNIQUE,                       -- Google account id
  avatar_url      TEXT,
  -- Saved delivery details (prefill checkout)
  phone           TEXT,
  city            TEXT,
  address         TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_login_at   TEXT
);

-- Only a hash of each session token is stored, so a leaked database can't be used to sign in.
CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,                       -- unix seconds
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);

-- Orders placed while signed in belong to the account (guests can still check out).
ALTER TABLE orders ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
