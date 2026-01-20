-- Fix admin functions type mismatch
-- The auth.users.email column is varchar(255), but functions declare TEXT return type
-- PostgreSQL requires explicit casting

-- Function to get recent users (for admin) - FIXED
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
    u.email::TEXT,  -- Cast varchar to text
    u.created_at,
    COALESCE(s.tier, 'free')::TEXT as subscription_tier,
    COALESCE(s.status, 'none')::TEXT as subscription_status
  FROM auth.users u
  LEFT JOIN subscriptions s ON s.user_id = u.id
  ORDER BY u.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent subscriptions (for admin) - FIXED
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
    u.email::TEXT as user_email,  -- Cast varchar to text
    s.tier::TEXT,
    s.status::TEXT,
    s.billing_interval::TEXT,
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
