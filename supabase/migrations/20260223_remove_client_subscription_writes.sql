-- ============================================
-- REMOVE CLIENT-SIDE SUBSCRIPTION WRITES
-- Reverts 20260209_client_subscription_writes.sql
-- Client must NEVER write subscription status.
-- Only service_role (Edge Functions) can write.
-- ============================================

DROP POLICY IF EXISTS "Users can insert own subscription" ON subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON subscriptions;
