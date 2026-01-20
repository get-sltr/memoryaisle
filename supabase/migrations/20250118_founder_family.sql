-- Founder Family System
-- Allows founder to gift permanent free premium to family/friends

-- Table for founder family codes
CREATE TABLE IF NOT EXISTS founder_family_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  redeemed_by UUID REFERENCES auth.users(id),
  redeemed_at TIMESTAMPTZ,
  label TEXT, -- e.g., "Mom", "Sister Sarah"
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast code lookup
CREATE INDEX idx_founder_family_codes_code ON founder_family_codes(code);

-- Table to track founder family members (users with permanent free premium)
CREATE TABLE IF NOT EXISTS founder_family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  granted_by UUID REFERENCES auth.users(id),
  code_used TEXT REFERENCES founder_family_codes(code),
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user lookup
CREATE INDEX idx_founder_family_members_user ON founder_family_members(user_id);

-- RLS Policies
ALTER TABLE founder_family_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_family_members ENABLE ROW LEVEL SECURITY;

-- Only founders can view/manage codes
CREATE POLICY "Founders can manage family codes"
  ON founder_family_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid() AND role = 'founder' AND is_active = true
    )
  );

-- Users can view their own founder family status
CREATE POLICY "Users can view own founder family status"
  ON founder_family_members FOR SELECT
  USING (user_id = auth.uid());

-- Founders can manage founder family members
CREATE POLICY "Founders can manage family members"
  ON founder_family_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid() AND role = 'founder' AND is_active = true
    )
  );

-- Function to generate a founder family code
CREATE OR REPLACE FUNCTION generate_founder_family_code(
  p_label TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  founder_id UUID;
BEGIN
  -- Check if caller is founder
  IF NOT is_founder() THEN
    RAISE EXCEPTION 'Only founders can generate family codes';
  END IF;

  founder_id := auth.uid();

  -- Generate unique code: MINN-XXXX-XXXX
  new_code := 'MINN-' ||
    UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 4)) || '-' ||
    UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 4));

  -- Insert the code
  INSERT INTO founder_family_codes (code, created_by, label)
  VALUES (new_code, founder_id, p_label);

  RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to redeem a founder family code
CREATE OR REPLACE FUNCTION redeem_founder_family_code(
  p_code TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  code_record RECORD;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in to redeem code';
  END IF;

  -- Check if user is already a founder family member
  IF EXISTS (SELECT 1 FROM founder_family_members WHERE user_id = current_user_id) THEN
    RAISE EXCEPTION 'You already have founder family access';
  END IF;

  -- Find the code
  SELECT * INTO code_record
  FROM founder_family_codes
  WHERE code = UPPER(p_code) AND is_active = true AND redeemed_by IS NULL;

  IF NOT FOUND THEN
    RETURN false; -- Invalid or already used code
  END IF;

  -- Mark code as redeemed
  UPDATE founder_family_codes
  SET redeemed_by = current_user_id, redeemed_at = NOW()
  WHERE id = code_record.id;

  -- Add user to founder family members
  INSERT INTO founder_family_members (user_id, granted_by, code_used, label)
  VALUES (current_user_id, code_record.created_by, code_record.code, code_record.label);

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is founder family member
CREATE OR REPLACE FUNCTION is_founder_family(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM founder_family_members
    WHERE user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all founder family codes (for admin)
CREATE OR REPLACE FUNCTION get_founder_family_codes()
RETURNS TABLE (
  id UUID,
  code TEXT,
  label TEXT,
  is_active BOOLEAN,
  redeemed_by UUID,
  redeemed_at TIMESTAMPTZ,
  redeemed_by_email TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT is_founder() THEN
    RAISE EXCEPTION 'Only founders can view family codes';
  END IF;

  RETURN QUERY
  SELECT
    fc.id,
    fc.code,
    fc.label,
    fc.is_active,
    fc.redeemed_by,
    fc.redeemed_at,
    u.email::TEXT as redeemed_by_email,
    fc.created_at
  FROM founder_family_codes fc
  LEFT JOIN auth.users u ON u.id = fc.redeemed_by
  WHERE fc.created_by = auth.uid()
  ORDER BY fc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
