-- Server-side admin (dashboard) sessions, so sign-out and "sign out everywhere" really revoke access.
-- Only a hash of each session token is stored. Apply locally:  npx wrangler d1 migrations apply cocos-art --local
-- Apply to prod: npx wrangler d1 migrations apply cocos-art --remote   (Railway applies it on start)

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash    TEXT PRIMARY KEY,          -- sha256 of the cookie value, never the value itself
  fingerprint   TEXT NOT NULL,             -- changes when ADMIN_EMAIL / ADMIN_PASSWORD change → such sessions stop working
  created_at    INTEGER NOT NULL,          -- unix seconds
  expires_at    INTEGER NOT NULL,          -- absolute lifetime
  last_seen_at  INTEGER NOT NULL,          -- idle timeout is measured from here
  ip_hash       TEXT,                      -- salted hash, never the raw IP
  user_agent    TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
