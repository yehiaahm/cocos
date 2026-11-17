-- Units in stock per product, set from the dashboard.
-- NULL = stock is not tracked (the product is only sold out when the "sold out" switch says so).
-- A number is tracked: orders subtract from it, cancelling an order gives it back, and 0 means sold out.
-- Apply locally:  npx wrangler d1 migrations apply cocos-art --local
-- Apply to prod:  npx wrangler d1 migrations apply cocos-art --remote   (Railway applies it on start)

ALTER TABLE product_overrides ADD COLUMN stock INTEGER;
