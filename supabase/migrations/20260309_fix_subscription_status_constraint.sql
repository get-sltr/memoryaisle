-- Expand subscriptions status CHECK to include lifecycle states
-- from Apple Server Notifications V2: expired, revoked, refunded.
ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'none', 'expired', 'revoked', 'refunded'));
