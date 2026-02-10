-- ============================================
-- SECURE APPLE IAP ARCHITECTURE
-- Remove client-side subscription writes.
-- Only server-side (service_role) can mutate subscriptions.
-- Add audit log table for Apple Server Notifications V2.
-- ============================================

-- 1. REMOVE DANGEROUS CLIENT-WRITE POLICIES
-- The "Users can update own subscription" policy allowed any authenticated
-- user to set themselves to premium. This is a critical security flaw.

DROP POLICY IF EXISTS "Users can update own subscription" ON subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscription" ON subscriptions;

-- Verify: only these two policies should remain on subscriptions:
--   "Users can view own subscription" (SELECT only)
--   "Service role can manage subscriptions" (ALL for service_role)

-- 2. ADD APPLE ENVIRONMENT FIELD TO SUBSCRIPTIONS
-- Tracks whether the subscription came from sandbox or production.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS apple_environment TEXT CHECK (apple_environment IN ('Sandbox', 'Production')),
  ADD COLUMN IF NOT EXISTS apple_expires_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS apple_auto_renew_status BOOLEAN DEFAULT false;

-- 3. APPLE SUBSCRIPTION NOTIFICATIONS AUDIT LOG
-- Every notification from Apple Server Notifications V2 is logged here.
-- This is critical for debugging, compliance, and dispute resolution.

CREATE TABLE IF NOT EXISTS apple_subscription_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL,
  subtype TEXT,
  notification_uuid TEXT UNIQUE,
  original_transaction_id TEXT,
  transaction_id TEXT,
  product_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  environment TEXT CHECK (environment IN ('Sandbox', 'Production')),
  signed_date TIMESTAMPTZ,
  raw_payload JSONB,
  processing_result TEXT CHECK (processing_result IN ('success', 'error', 'ignored')),
  processing_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_apple_notif_type
  ON apple_subscription_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_apple_notif_original_txn
  ON apple_subscription_notifications(original_transaction_id);
CREATE INDEX IF NOT EXISTS idx_apple_notif_user
  ON apple_subscription_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_apple_notif_created
  ON apple_subscription_notifications(created_at DESC);

-- RLS: No client access to notification logs. Service role only.
ALTER TABLE apple_subscription_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage apple notifications"
  ON apple_subscription_notifications FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- 4. GRANT ADMIN READ ACCESS TO NOTIFICATION LOGS
-- Founders/admins can view notification logs through the admin RPC.
CREATE OR REPLACE FUNCTION get_apple_notification_logs(
  p_limit INTEGER DEFAULT 50
)
RETURNS SETOF apple_subscription_notifications AS $$
BEGIN
  -- Only admins can call this
  IF NOT EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT * FROM apple_subscription_notifications
  ORDER BY created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
