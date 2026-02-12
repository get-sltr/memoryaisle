-- ============================================
-- USER SUBSCRIPTIONS TABLE
-- ============================================
-- Tracks Apple IAP subscription status per user.
-- Only writable by service_role (Edge Functions).
-- Clients can only SELECT their own row.

CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('active', 'inactive', 'expired', 'cancelled', 'grace_period', 'billing_retry')),
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  original_transaction_id TEXT,
  latest_transaction_id TEXT,
  original_purchase_date TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_trial BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);

-- Enable RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only SELECT their own subscription row
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- No client INSERT/UPDATE/DELETE — only service_role can write
-- (Edge Functions use service_role key to upsert)

-- Auto-update updated_at on changes
CREATE TRIGGER on_subscription_updated
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
