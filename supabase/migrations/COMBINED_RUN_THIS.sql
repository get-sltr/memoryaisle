-- ============================================
-- COMBINED MIGRATION - RUN THIS IN SUPABASE SQL EDITOR
-- Creates subscriptions + admin system
-- ============================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create handle_updated_at function if not exists
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 1: SUBSCRIPTIONS TABLE
-- ============================================

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON subscriptions;

-- Create policies
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
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

DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_subscription();

-- Usage tracking table
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

CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_feature ON usage_tracking(user_id, feature, period_start);

ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own usage" ON usage_tracking;
DROP POLICY IF EXISTS "Service role can manage usage" ON usage_tracking;

CREATE POLICY "Users can view own usage"
  ON usage_tracking FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage usage"
  ON usage_tracking FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Usage functions
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

-- ============================================
-- PART 2: ADMIN SYSTEM
-- ============================================

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('founder', 'admin', 'support')),
  permissions JSONB DEFAULT '{"view_users": true, "view_subscriptions": true, "view_errors": true, "manage_users": false}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);

-- Error logs table
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  component TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  severity TEXT DEFAULT 'error' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);

-- Admin analytics views
CREATE OR REPLACE VIEW admin_daily_signups AS
SELECT
  DATE(created_at) as signup_date,
  COUNT(*) as signups
FROM auth.users
GROUP BY DATE(created_at)
ORDER BY signup_date DESC;

CREATE OR REPLACE VIEW admin_subscription_stats AS
SELECT
  tier,
  billing_interval,
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE cancel_at_period_end = true) as canceling
FROM subscriptions
GROUP BY tier, billing_interval, status;

CREATE OR REPLACE VIEW admin_error_summary AS
SELECT
  DATE(created_at) as error_date,
  error_type,
  severity,
  COUNT(*) as error_count,
  COUNT(DISTINCT user_id) as affected_users
FROM error_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), error_type, severity
ORDER BY error_date DESC, error_count DESC;

-- RLS for admin tables
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view admin_users" ON admin_users;
DROP POLICY IF EXISTS "Founders can manage admin_users" ON admin_users;
DROP POLICY IF EXISTS "Anyone can insert error logs" ON error_logs;
DROP POLICY IF EXISTS "Admins can view error logs" ON error_logs;
DROP POLICY IF EXISTS "Admins can update error logs" ON error_logs;

CREATE POLICY "Admins can view admin_users"
  ON admin_users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid() AND au.is_active = true
    )
  );

CREATE POLICY "Founders can manage admin_users"
  ON admin_users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid() AND au.role = 'founder' AND au.is_active = true
    )
  );

CREATE POLICY "Anyone can insert error logs"
  ON error_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view error logs"
  ON error_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid() AND au.is_active = true
    )
  );

CREATE POLICY "Admins can update error logs"
  ON error_logs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid() AND au.is_active = true
    )
  );

-- Admin helper functions
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = check_user_id AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_founder(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = check_user_id AND role = 'founder' AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM auth.users),
    'users_today', (SELECT COUNT(*) FROM auth.users WHERE DATE(created_at) = CURRENT_DATE),
    'users_this_week', (SELECT COUNT(*) FROM auth.users WHERE created_at > NOW() - INTERVAL '7 days'),
    'users_this_month', (SELECT COUNT(*) FROM auth.users WHERE created_at > NOW() - INTERVAL '30 days'),
    'total_premium', (SELECT COUNT(*) FROM subscriptions WHERE tier = 'premium' AND status = 'active'),
    'premium_monthly', (SELECT COUNT(*) FROM subscriptions WHERE tier = 'premium' AND status = 'active' AND billing_interval = 'month'),
    'premium_yearly', (SELECT COUNT(*) FROM subscriptions WHERE tier = 'premium' AND status = 'active' AND billing_interval = 'year'),
    'mrr', (
      SELECT COALESCE(SUM(
        CASE
          WHEN billing_interval = 'month' THEN 9.99
          WHEN billing_interval = 'year' THEN 47.88 / 12
          ELSE 0
        END
      ), 0)
      FROM subscriptions WHERE tier = 'premium' AND status = 'active'
    ),
    'errors_today', (SELECT COUNT(*) FROM error_logs WHERE DATE(created_at) = CURRENT_DATE),
    'errors_this_week', (SELECT COUNT(*) FROM error_logs WHERE created_at > NOW() - INTERVAL '7 days'),
    'critical_errors', (SELECT COUNT(*) FROM error_logs WHERE severity = 'critical' AND resolved = false)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_admin_recent_users(limit_count INT DEFAULT 50)
RETURNS TABLE (
  id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  subscription_tier TEXT,
  subscription_status TEXT
) AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email,
    u.created_at,
    COALESCE(s.tier, 'free') as subscription_tier,
    COALESCE(s.status, 'none') as subscription_status
  FROM auth.users u
  LEFT JOIN subscriptions s ON s.user_id = u.id
  ORDER BY u.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_admin_recent_subscriptions(limit_count INT DEFAULT 50)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email TEXT,
  tier TEXT,
  status TEXT,
  billing_interval TEXT,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    u.email as user_email,
    s.tier,
    s.status,
    s.billing_interval,
    s.current_period_end,
    s.cancel_at_period_end,
    s.created_at
  FROM subscriptions s
  JOIN auth.users u ON u.id = s.user_id
  WHERE s.tier = 'premium'
  ORDER BY s.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant founder access function
CREATE OR REPLACE FUNCTION grant_founder_access(founder_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  founder_user_id UUID;
BEGIN
  SELECT id INTO founder_user_id FROM auth.users WHERE email = founder_email;

  INSERT INTO admin_users (user_id, email, role, permissions, is_active)
  VALUES (
    founder_user_id,
    founder_email,
    'founder',
    '{
      "view_users": true,
      "view_subscriptions": true,
      "view_errors": true,
      "manage_users": true,
      "manage_subscriptions": true,
      "manage_admins": true,
      "full_access": true
    }'::jsonb,
    true
  )
  ON CONFLICT (email) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    role = 'founder',
    permissions = EXCLUDED.permissions,
    is_active = true,
    updated_at = NOW();

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for updated_at on admin_users
CREATE OR REPLACE FUNCTION update_admin_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_admin_users_updated_at ON admin_users;
CREATE TRIGGER trigger_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_users_updated_at();

-- Auto-grant founder access when kminn121@gmail.com signs up
CREATE OR REPLACE FUNCTION auto_grant_founder_access()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email = 'kminn121@gmail.com' THEN
    INSERT INTO admin_users (user_id, email, role, permissions, is_active)
    VALUES (
      NEW.id,
      NEW.email,
      'founder',
      '{
        "view_users": true,
        "view_subscriptions": true,
        "view_errors": true,
        "manage_users": true,
        "manage_subscriptions": true,
        "manage_admins": true,
        "full_access": true
      }'::jsonb,
      true
    )
    ON CONFLICT (email) DO UPDATE SET
      user_id = NEW.id,
      is_active = true,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Try to create trigger on auth.users (may need superuser)
DO $$
BEGIN
  DROP TRIGGER IF EXISTS trigger_auto_grant_founder ON auth.users;
  CREATE TRIGGER trigger_auto_grant_founder
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION auto_grant_founder_access();
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Could not create trigger on auth.users - you may need to run this part manually';
END $$;

-- Grant founder access to kminn121@gmail.com if they already exist
DO $$
BEGIN
  PERFORM grant_founder_access('kminn121@gmail.com');
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'User kminn121@gmail.com may not exist yet - will be granted access on signup';
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration complete! Subscriptions + Admin system created.';
  RAISE NOTICE '✅ kminn121@gmail.com will have founder access.';
END $$;
