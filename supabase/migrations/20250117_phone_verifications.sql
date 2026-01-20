-- Custom Phone OTP Verification Table
-- Uses AWS SNS instead of Supabase built-in phone providers

CREATE TABLE phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT false,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_phone_verifications_phone ON phone_verifications(phone);
CREATE INDEX idx_phone_verifications_expires ON phone_verifications(expires_at);

-- RLS policies
ALTER TABLE phone_verifications ENABLE ROW LEVEL SECURITY;

-- Only allow insert/select via service role (Edge Functions)
-- No direct client access for security
CREATE POLICY "Service role only"
  ON phone_verifications
  FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-cleanup expired codes (optional - can also use pg_cron)
CREATE OR REPLACE FUNCTION cleanup_expired_verifications()
RETURNS void AS $$
BEGIN
  DELETE FROM phone_verifications
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
