-- ============================================
-- APPLE IAP MIGRATION
-- Add Apple In-App Purchase fields to subscriptions
-- ============================================

-- Add Apple IAP columns to subscriptions table
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS apple_product_id TEXT,
  ADD COLUMN IF NOT EXISTS apple_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS apple_original_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS apple_receipt TEXT;

-- Index for Apple transaction lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_apple_transaction
  ON subscriptions(apple_transaction_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_apple_original_transaction
  ON subscriptions(apple_original_transaction_id);

-- Update the usage tracking table to add a date column if missing
ALTER TABLE usage_tracking
  ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;

-- Rename period_start to date if it exists (for consistency with code)
-- First check if we need to migrate data
DO $$
BEGIN
  -- If 'date' column is null but 'period_start' has data, copy it
  UPDATE usage_tracking SET date = period_start WHERE date IS NULL AND period_start IS NOT NULL;
END $$;

-- Create index on the date column for usage tracking
CREATE INDEX IF NOT EXISTS idx_usage_tracking_date
  ON usage_tracking(user_id, feature, date);

-- Update the increment_daily_usage function to work with date column
CREATE OR REPLACE FUNCTION increment_daily_usage(
  p_user_id UUID,
  p_feature TEXT,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO usage_tracking (user_id, feature, count, date, period_start)
  VALUES (p_user_id, p_feature, 1, p_date, p_date)
  ON CONFLICT (user_id, feature, period_start)
  DO UPDATE SET
    count = usage_tracking.count + 1,
    date = p_date,
    updated_at = NOW()
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_daily_usage(UUID, TEXT, DATE) TO authenticated;

-- Policy to allow users to insert their own usage
CREATE POLICY IF NOT EXISTS "Users can insert own usage"
  ON usage_tracking FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to update their own usage
CREATE POLICY IF NOT EXISTS "Users can update own usage"
  ON usage_tracking FOR UPDATE
  USING (auth.uid() = user_id);
