-- Extended Security Fixes Migration
-- Fixes function search paths, RLS policies, and enables leaked password protection
-- Run in Supabase SQL Editor with admin privileges

-- ============================================
-- 1. FIX FUNCTION SEARCH PATHS
-- All SECURITY DEFINER functions must have immutable search_path
-- ============================================

-- Fix: cleanup_expired_verifications
CREATE OR REPLACE FUNCTION cleanup_expired_verifications()
RETURNS void AS $$
BEGIN
  DELETE FROM phone_verifications
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix: update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix: handle_new_user_subscription
CREATE OR REPLACE FUNCTION handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'free', 'none')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix: increment_usage
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix: get_usage
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix: is_admin
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = check_user_id AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix: is_founder
CREATE OR REPLACE FUNCTION is_founder(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = check_user_id AND role = 'founder' AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix: get_admin_dashboard_stats
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix: get_admin_recent_users
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix: get_admin_recent_subscriptions
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix: grant_founder_access
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix: update_admin_users_updated_at
CREATE OR REPLACE FUNCTION update_admin_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix: auto_grant_founder_access
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix: normalize_item_name (IMMUTABLE functions are safe, but add search_path anyway)
CREATE OR REPLACE FUNCTION normalize_item_name(item_name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    TRIM(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(item_name, '\s*\([^)]*\)\s*', ' ', 'g'),
          '[^a-zA-Z0-9\s]', '', 'g'
        ),
        '\s+', ' ', 'g'
      )
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Fix: update_purchase_pattern
CREATE OR REPLACE FUNCTION update_purchase_pattern()
RETURNS TRIGGER AS $$
DECLARE
  v_household_id UUID;
  v_normalized_name TEXT;
  v_existing_pattern RECORD;
  v_last_purchased TIMESTAMPTZ;
  v_days_since_last INTEGER;
  v_new_avg_interval INTEGER;
  v_new_confidence DECIMAL(3,2);
BEGIN
  IF NEW.is_completed = TRUE AND (OLD.is_completed = FALSE OR OLD.is_completed IS NULL) THEN
    SELECT gl.household_id INTO v_household_id
    FROM grocery_lists gl
    WHERE gl.id = NEW.list_id;

    v_normalized_name = normalize_item_name(NEW.name);

    SELECT * INTO v_existing_pattern
    FROM purchase_patterns
    WHERE household_id = v_household_id
      AND normalize_item_name(item_name) = v_normalized_name;

    IF v_existing_pattern.id IS NOT NULL THEN
      v_last_purchased := v_existing_pattern.last_purchased;
      v_days_since_last := EXTRACT(DAY FROM (NOW() - v_last_purchased))::INTEGER;

      IF v_days_since_last >= 1 THEN
        v_new_avg_interval := (
          (v_existing_pattern.avg_interval_days * v_existing_pattern.purchase_count + v_days_since_last) /
          (v_existing_pattern.purchase_count + 1)
        )::INTEGER;

        v_new_confidence := LEAST(0.95, v_existing_pattern.confidence + 0.05);

        UPDATE purchase_patterns
        SET
          avg_interval_days = GREATEST(1, v_new_avg_interval),
          last_purchased = NOW(),
          next_predicted = NOW() + (GREATEST(1, v_new_avg_interval) || ' days')::INTERVAL,
          confidence = v_new_confidence,
          purchase_count = purchase_count + 1,
          updated_at = NOW()
        WHERE id = v_existing_pattern.id;
      END IF;

    ELSE
      INSERT INTO purchase_patterns (
        household_id,
        item_name,
        avg_interval_days,
        last_purchased,
        next_predicted,
        confidence,
        purchase_count
      ) VALUES (
        v_household_id,
        NEW.name,
        7,
        NOW(),
        NOW() + INTERVAL '7 days',
        0.3,
        1
      )
      ON CONFLICT (household_id, item_name) DO NOTHING;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix: get_due_items
CREATE OR REPLACE FUNCTION get_due_items(p_household_id UUID)
RETURNS TABLE (
  item_name TEXT,
  days_overdue INTEGER,
  confidence DECIMAL(3,2),
  last_purchased TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pp.item_name,
    EXTRACT(DAY FROM (NOW() - pp.next_predicted))::INTEGER as days_overdue,
    pp.confidence,
    pp.last_purchased
  FROM purchase_patterns pp
  WHERE pp.household_id = p_household_id
    AND pp.next_predicted <= NOW()
    AND pp.confidence >= 0.3
  ORDER BY pp.confidence DESC, (NOW() - pp.next_predicted) DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix: handle_new_user (from initial schema)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_household_id UUID;
BEGIN
  INSERT INTO households (name, created_by)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'name', 'My') || '''s Household', NEW.id)
  RETURNING id INTO v_household_id;

  INSERT INTO users (id, email, name, household_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NULL),
    v_household_id
  );

  INSERT INTO grocery_lists (household_id, name)
  VALUES (v_household_id, 'Grocery List');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix: get_user_household_id (helper function used in RLS policies)
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = public;

-- Fix: handle_item_completed (trigger function)
CREATE OR REPLACE FUNCTION handle_item_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_completed = TRUE AND OLD.is_completed = FALSE THEN
    NEW.completed_at = NOW();
  ELSIF NEW.is_completed = FALSE THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix: handle_updated_at (generic trigger function)
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix: handle_purchase_normalize (trigger function)
CREATE OR REPLACE FUNCTION handle_purchase_normalize()
RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_name = normalize_item_name(NEW.item_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================
-- 2. FIX RLS POLICIES THAT ARE "ALWAYS TRUE"
-- These policies allow any authenticated user to insert
-- We need to add proper user_id checks
-- ============================================

-- Fix: error_logs INSERT policy - users can only insert logs for themselves or null user_id
DROP POLICY IF EXISTS "Anyone can insert error logs" ON error_logs;
CREATE POLICY "Users can insert error logs"
  ON error_logs FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Fix: households INSERT policy - users can only create households where they are the creator
DROP POLICY IF EXISTS "Users can create households" ON households;
DROP POLICY IF EXISTS "Users can insert own household" ON households;
DROP POLICY IF EXISTS "Authenticated users can create household" ON households;
CREATE POLICY "Users can insert households they create"
  ON households FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Fix: households UPDATE policy - users can only update their own household
DROP POLICY IF EXISTS "Users can update own household" ON households;
CREATE POLICY "Users can update own household"
  ON households FOR UPDATE
  USING (id IN (SELECT household_id FROM users WHERE id = auth.uid()));

-- Fix: users INSERT policy - users can only create their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (id = auth.uid());

-- ============================================
-- 3. ENABLE LEAKED PASSWORD PROTECTION
-- This is done via Supabase Auth Settings in the Dashboard
-- But we can set up the necessary configuration
-- ============================================

-- Note: Leaked password protection must be enabled in Supabase Dashboard:
-- Authentication > Providers > Email > Enable "Check passwords against HaveIBeenPwned"
-- This cannot be done via SQL, but this comment serves as a reminder

-- ============================================
-- 4. ADDITIONAL SECURITY HARDENING
-- ============================================

-- Ensure service role policies don't use jwt() which can be spoofed
-- These are fine as-is since they check auth.jwt() ->> 'role' = 'service_role'
-- which can only be set by the actual service role key

-- Revoke unnecessary permissions from anon role
REVOKE ALL ON error_logs FROM anon;
REVOKE ALL ON admin_users FROM anon;
REVOKE ALL ON subscriptions FROM anon;
REVOKE ALL ON usage_tracking FROM anon;

-- Grant only necessary permissions to authenticated role
GRANT SELECT, INSERT ON error_logs TO authenticated;
GRANT SELECT ON admin_users TO authenticated;
GRANT SELECT ON subscriptions TO authenticated;
GRANT SELECT ON usage_tracking TO authenticated;

-- ============================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================
-- To verify search_path is set on all functions, run:
-- SELECT proname, prosecdef, proconfig
-- FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND prosecdef = true;
--
-- To verify RLS policies, run:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public';
