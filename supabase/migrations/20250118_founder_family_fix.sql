-- Fix search_path security issue on founder family functions

-- Recreate with secure search_path
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_founder_family(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM founder_family_members
    WHERE user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
