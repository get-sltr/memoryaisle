-- Admin System Migration
-- Creates admin users table, error logging, and analytics views

-- ============================================
-- ADMIN USERS TABLE
-- ============================================
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

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);

-- ============================================
-- ERROR LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  error_type TEXT NOT NULL, -- 'crash', 'api', 'validation', 'network', 'unknown'
  error_message TEXT NOT NULL,
  error_stack TEXT,
  component TEXT, -- Which screen/component the error occurred in
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional context (device info, app version, etc.)
  severity TEXT DEFAULT 'error' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for error log queries
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);

-- ============================================
-- ADMIN ANALYTICS VIEWS
-- ============================================

-- Daily user signups view
CREATE OR REPLACE VIEW admin_daily_signups AS
SELECT
  DATE(created_at) as signup_date,
  COUNT(*) as signups
FROM auth.users
GROUP BY DATE(created_at)
ORDER BY signup_date DESC;

-- Subscription overview view
CREATE OR REPLACE VIEW admin_subscription_stats AS
SELECT
  tier,
  billing_interval,
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE cancel_at_period_end = true) as canceling
FROM subscriptions
GROUP BY tier, billing_interval, status;

-- Error summary view
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

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Admin users can only be viewed/managed by other admins
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

-- Error logs policies
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

-- ============================================
-- ADMIN HELPER FUNCTIONS
-- ============================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = check_user_id AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is founder
CREATE OR REPLACE FUNCTION is_founder(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = check_user_id AND role = 'founder' AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get admin dashboard stats
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Check if caller is admin
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

-- Function to get recent users (for admin)
CREATE OR REPLACE FUNCTION get_admin_recent_users(limit_count INT DEFAULT 50)
RETURNS TABLE (
  id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  subscription_tier TEXT,
  subscription_status TEXT
) AS $$
BEGIN
  -- Check if caller is admin
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

-- Function to get recent subscriptions (for admin)
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
  -- Check if caller is admin
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

-- ============================================
-- GRANT FOUNDER ACCESS TO kminn121@gmail.com
-- ============================================
-- This will be done via a function that can be called after the user exists

CREATE OR REPLACE FUNCTION grant_founder_access(founder_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  founder_user_id UUID;
BEGIN
  -- Get user ID from email
  SELECT id INTO founder_user_id FROM auth.users WHERE email = founder_email;

  -- Insert or update admin_users
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

-- Grant founder access immediately (will work once user signs up)
-- If the user already exists, this will grant access now
DO $$
BEGIN
  PERFORM grant_founder_access('kminn121@gmail.com');
EXCEPTION
  WHEN OTHERS THEN
    -- User may not exist yet, that's okay
    NULL;
END $$;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for admin_users
CREATE OR REPLACE FUNCTION update_admin_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- Note: This trigger needs to be created by a superuser on auth.users
-- Run this in Supabase SQL editor with admin privileges:
-- CREATE TRIGGER trigger_auto_grant_founder
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION auto_grant_founder_access();
