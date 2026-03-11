-- Server-side quota enforcement for daily usage limits.
-- Checks subscription tier before incrementing usage count.
-- Returns -1 if quota exceeded (client should show paywall).

CREATE OR REPLACE FUNCTION increment_daily_usage(
  p_user_id UUID,
  p_feature TEXT,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
  v_limit INTEGER;
  v_tier TEXT;
  v_status TEXT;
BEGIN
  -- Look up subscription tier and status
  SELECT tier, status INTO v_tier, v_status
  FROM subscriptions
  WHERE user_id = p_user_id;

  -- Determine if user has active premium
  IF v_tier = 'premium' AND v_status IN ('active', 'trialing') THEN
    -- Premium: unlimited, just increment
    INSERT INTO usage_tracking (user_id, feature, count, date, period_start)
    VALUES (p_user_id, p_feature, 1, p_date, p_date)
    ON CONFLICT (user_id, feature, period_start)
    DO UPDATE SET
      count = usage_tracking.count + 1,
      date = p_date,
      updated_at = NOW()
    RETURNING count INTO v_count;

    RETURN v_count;
  END IF;

  -- Free tier: enforce limits
  IF p_feature = 'mira_queries' THEN
    v_limit := 10;
  ELSIF p_feature = 'recipes' THEN
    v_limit := 3;
  ELSE
    v_limit := 10; -- default
  END IF;

  -- Check current usage
  SELECT count INTO v_count
  FROM usage_tracking
  WHERE user_id = p_user_id
    AND feature = p_feature
    AND date = p_date;

  -- If already at or over limit, reject
  IF v_count IS NOT NULL AND v_count >= v_limit THEN
    RETURN -1;
  END IF;

  -- Under limit, increment
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
