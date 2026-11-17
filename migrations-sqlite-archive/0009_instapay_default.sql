-- The shop's InstaPay account, so customers can pay as soon as this is applied (Dashboard → الإعدادات shows and edits it).
-- A value the owner already typed in the dashboard is never touched: only a missing or empty setting is filled in.
-- Apply locally:  npx wrangler d1 migrations apply cocos-art --local
-- Apply to prod:  npx wrangler d1 migrations apply cocos-art --remote   (Railway applies it on start)

INSERT OR IGNORE INTO settings (key, value) VALUES ('instapay', 'mariam.elzomor@instapay');
INSERT OR IGNORE INTO settings (key, value) VALUES ('instapayLink', 'https://ipn.eg/S/mariam.elzomor/instapay/8IqYGk');

UPDATE settings SET value = 'mariam.elzomor@instapay' WHERE key = 'instapay' AND TRIM(value) = '';
UPDATE settings SET value = 'https://ipn.eg/S/mariam.elzomor/instapay/8IqYGk' WHERE key = 'instapayLink' AND TRIM(value) = '';
