-- Shipment details (courier + tracking number) shown to the customer on their order page,
-- and the status an order_events row moved the order to (so the customer's timeline can show dates).
-- Apply locally:  npx wrangler d1 migrations apply cocos-art --local
-- Apply to prod:  npx wrangler d1 migrations apply cocos-art --remote   (Railway applies it on start)

ALTER TABLE orders ADD COLUMN courier TEXT;
ALTER TABLE orders ADD COLUMN tracking_number TEXT;
ALTER TABLE order_events ADD COLUMN status TEXT;
