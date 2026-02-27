-- ============================================
-- DELETE USER ACCOUNT
-- Fixes 3 security vulnerabilities:
--   1. Subscription DELETE silently failed (no RLS DELETE policy)
--   2. delete_user_account RPC didn't exist (always fell back to partial delete)
--   3. Restore purchases could reactivate a deleted account's subscription
-- ============================================

-- ============================================
-- A. BLACKLIST TABLE FOR DELETED SUBSCRIPTIONS
-- Prevents restore-purchases from reactivating a subscription
-- that belonged to a deleted account.
-- ============================================
CREATE TABLE IF NOT EXISTS deleted_subscription_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_transaction_id TEXT NOT NULL,
  deleted_user_id UUID NOT NULL,
  deleted_user_email TEXT,
  subscription_expiry TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup by Apple transaction ID
CREATE UNIQUE INDEX idx_deleted_sub_txn_original
  ON deleted_subscription_transactions(original_transaction_id);

-- RLS: service-role only (same pattern as apple_subscription_notifications)
ALTER TABLE deleted_subscription_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage deleted subscription transactions"
  ON deleted_subscription_transactions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- B. delete_user_account() — SECURITY DEFINER
-- Called by the client via supabase.rpc('delete_user_account').
-- Uses auth.uid() to identify the caller.
-- Single atomic transaction — if anything fails, everything rolls back.
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
  -- Identify the caller
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user email for audit trail
  SELECT email INTO v_user_email
  FROM auth.users WHERE id = v_user_id;

  -- ------------------------------------------------
  -- 1. Archive Apple transaction to blacklist (if subscription exists)
  -- ------------------------------------------------
  SELECT apple_original_transaction_id, current_period_end
  INTO v_original_txn_id, v_sub_expiry
  FROM subscriptions
  WHERE user_id = v_user_id
    AND tier = 'premium'
    AND apple_original_transaction_id IS NOT NULL;

  IF v_original_txn_id IS NOT NULL THEN
    INSERT INTO deleted_subscription_transactions (
      original_transaction_id,
      deleted_user_id,
      deleted_user_email,
      subscription_expiry
    ) VALUES (
      v_original_txn_id,
      v_user_id,
      v_user_email,
      v_sub_expiry
    )
    ON CONFLICT (original_transaction_id) DO NOTHING;
  END IF;

  -- ------------------------------------------------
  -- 2. Handle household membership
  -- ------------------------------------------------
  SELECT household_id INTO v_household_id
  FROM users WHERE id = v_user_id;

  IF v_household_id IS NOT NULL THEN
    -- Check if this user owns the household
    SELECT (created_by = v_user_id) INTO v_is_owner
    FROM households WHERE id = v_household_id;

    IF v_is_owner THEN
      -- Detach all other members from this household first
      UPDATE users
      SET household_id = NULL
      WHERE household_id = v_household_id
        AND id != v_user_id;

      -- Delete the household (cascades to grocery_lists → list_items,
      -- meal_plans → planned_meals, recipes, family_members,
      -- purchase_history, purchase_patterns)
      DELETE FROM households WHERE id = v_household_id;
    ELSE
      -- Just a member: remove their family_members record, then detach
      DELETE FROM family_members WHERE user_id = v_user_id;

      UPDATE users
      SET household_id = NULL
      WHERE id = v_user_id;
    END IF;
  END IF;

  -- ------------------------------------------------
  -- 3. Clear FK references that lack ON DELETE SET NULL/CASCADE.
  --    Without this, DELETE FROM auth.users fails with FK violation.
  -- ------------------------------------------------
  UPDATE admin_users SET created_by = NULL WHERE created_by = v_user_id;
  UPDATE error_logs SET resolved_by = NULL WHERE resolved_by = v_user_id;
  UPDATE founder_family_codes SET created_by = NULL WHERE created_by = v_user_id;
  UPDATE founder_family_codes SET redeemed_by = NULL WHERE redeemed_by = v_user_id;
  UPDATE founder_family_members SET granted_by = NULL WHERE granted_by = v_user_id;

  -- ------------------------------------------------
  -- 4. Delete auth.users row — cascades everything else:
  --    CASCADE: public.users → loyalty_cards, orders, push_tokens,
  --             wallet_credits, promo_redemptions, gift_cards
  --    CASCADE: subscriptions, usage_tracking, admin_users,
  --             mira_conversations, founder_family_members
  --    SET NULL: error_logs, apple_subscription_notifications,
  --             list_items.added_by, family_members.user_id
  -- ------------------------------------------------
  DELETE FROM auth.users WHERE id = v_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;
