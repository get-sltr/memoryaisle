-- Add phone verification tracking to users table
-- This supports the 2-step auth flow: email/OAuth first, then phone verification

-- Add phone_verified flag
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Add timestamp for when phone was verified
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

-- Create index for faster lookups of unverified users
CREATE INDEX IF NOT EXISTS idx_users_phone_verified ON users(phone_verified) WHERE phone_verified = FALSE;
