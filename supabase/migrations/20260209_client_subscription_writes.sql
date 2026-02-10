-- ============================================
-- STOREKIT 2 ON-DEVICE VERIFICATION
-- Re-enable client-side INSERT/UPDATE on subscriptions table.
-- StoreKit 2 transactions are verified at the OS level.
-- Apple Server Notifications V2 remain the ultimate source of truth.
-- ============================================

-- 1. Allow authenticated users to INSERT their own subscription row
CREATE POLICY "Users can insert own subscription"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 2. Allow authenticated users to UPDATE their own subscription row
CREATE POLICY "Users can update own subscription"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
