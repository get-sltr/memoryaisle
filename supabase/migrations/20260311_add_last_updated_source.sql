-- ============================================
-- ADD MISSING last_updated_source COLUMN
-- Both apple-verify-receipt and apple-server-notifications
-- edge functions write to this column, but it was never created.
-- This caused every subscription upsert to fail with a column-not-found
-- error, meaning purchases completed in StoreKit but premium never
-- activated in the database (Apple Review rejection 2.1(b)).
-- ============================================

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS last_updated_source TEXT;

-- Backfill: mark any existing active subscriptions so the
-- source-priority logic in apple-verify-receipt doesn't skip them.
UPDATE subscriptions
  SET last_updated_source = 'backfill'
  WHERE last_updated_source IS NULL
    AND tier = 'premium'
    AND status IN ('active', 'trialing');
