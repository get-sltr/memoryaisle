-- ============================================
-- SUBSCRIPTIONS TABLE
-- Stripe subscription management
-- ============================================

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'premium')),
  status TEXT NOT NULL DEFAULT 'none' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'none')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  billing_interval TEXT CHECK (billing_interval IN ('month', 'year')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Index for faster lookups
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all subscriptions (for webhooks)
CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Auto-update updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Auto-create free subscription for new users
CREATE OR REPLACE FUNCTION handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'free', 'none')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_subscription();

-- Usage tracking table (for quota enforcement)
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL CHECK (feature IN ('mira_queries', 'recipes', 'meal_plans')),
  count INTEGER NOT NULL DEFAULT 0,
  period_start DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, feature, period_start)
);

-- Index for usage tracking
CREATE INDEX idx_usage_tracking_user_feature ON usage_tracking(user_id, feature, period_start);

-- Enable RLS on usage tracking
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON usage_tracking FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage usage"
  ON usage_tracking FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to increment usage
CREATE OR REPLACE FUNCTION increment_usage(
  p_user_id UUID,
  p_feature TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO usage_tracking (user_id, feature, count, period_start)
  VALUES (p_user_id, p_feature, 1, CURRENT_DATE)
  ON CONFLICT (user_id, feature, period_start)
  DO UPDATE SET
    count = usage_tracking.count + 1,
    updated_at = NOW()
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current usage
CREATE OR REPLACE FUNCTION get_usage(
  p_user_id UUID,
  p_feature TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COALESCE(count, 0) INTO v_count
  FROM usage_tracking
  WHERE user_id = p_user_id
    AND feature = p_feature
    AND period_start = CURRENT_DATE;

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
