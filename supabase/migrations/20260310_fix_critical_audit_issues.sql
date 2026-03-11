-- Fix critical issues found in code audit (2026-03-10)
--
-- 1. delete_user_account references dropped tables (founder_family_codes, founder_family_members)
-- 2. increment_daily_usage missing SET search_path = public (SECURITY DEFINER)
-- 3. get_apple_notification_logs missing SET search_path = public
-- 4. cleanup_stale_push_tokens missing SET search_path = public

-- ============================================
-- 1. Fix delete_user_account: remove references to dropped tables
-- ============================================
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_household_id UUID;
  v_is_owner BOOLEAN;
  v_original_txn_id TEXT;
  v_sub_expiry TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_user_email
  FROM auth.users WHERE id = v_user_id;

  -- Archive Apple transaction to blacklist
  SELECT apple_original_transaction_id, current_period_end
  INTO v_original_txn_id, v_sub_expiry
  FROM subscriptions
  WHERE user_id = v_user_id
    AND tier = 'premium'
    AND apple_original_transaction_id IS NOT NULL;

  IF v_original_txn_id IS NOT NULL THEN
    INSERT INTO deleted_subscription_transactions (
      original_transaction_id, deleted_user_id, deleted_user_email, subscription_expiry
    ) VALUES (v_original_txn_id, v_user_id, v_user_email, v_sub_expiry)
    ON CONFLICT (original_transaction_id) DO NOTHING;
  END IF;

  -- Handle household membership
  SELECT household_id INTO v_household_id
  FROM users WHERE id = v_user_id;

  IF v_household_id IS NOT NULL THEN
    SELECT (created_by = v_user_id) INTO v_is_owner
    FROM households WHERE id = v_household_id;

    IF v_is_owner THEN
      UPDATE users SET household_id = NULL
      WHERE household_id = v_household_id AND id != v_user_id;
      DELETE FROM households WHERE id = v_household_id;
    ELSE
      DELETE FROM family_members WHERE user_id = v_user_id;
      UPDATE users SET household_id = NULL WHERE id = v_user_id;
    END IF;
  END IF;

  -- Clear FK references (founder tables were dropped, removed from here)
  UPDATE admin_users SET created_by = NULL WHERE created_by = v_user_id;
  UPDATE error_logs SET resolved_by = NULL WHERE resolved_by = v_user_id;

  -- Delete auth user (cascades everything else)
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;

-- ============================================
-- 2. Fix increment_daily_usage: add search_path
-- ============================================
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
  SELECT tier, status INTO v_tier, v_status
  FROM subscriptions
  WHERE user_id = p_user_id;

  IF v_tier = 'premium' AND v_status IN ('active', 'trialing') THEN
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

  IF p_feature = 'mira_queries' THEN
    v_limit := 10;
  ELSIF p_feature = 'recipes' THEN
    v_limit := 3;
  ELSE
    v_limit := 10;
  END IF;

  SELECT count INTO v_count
  FROM usage_tracking
  WHERE user_id = p_user_id
    AND feature = p_feature
    AND date = p_date;

  IF v_count IS NOT NULL AND v_count >= v_limit THEN
    RETURN -1;
  END IF;

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
