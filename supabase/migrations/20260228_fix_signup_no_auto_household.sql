-- ============================================================
-- FIX: Updated handle_new_user trigger
-- Run this in Supabase SQL Editor
--
-- WHAT CHANGED: Removed auto-creation of household and grocery list.
-- WHY: The trigger was creating a household before the user could go
--       through HouseholdSetup, causing the onboarding screen to flash
--       for ~2 seconds then redirect away.
-- NOW: User profile only. Household created via HouseholdSetup screen.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_user_name TEXT;
BEGIN
  -- Get user name from various sources (OAuth providers use different fields)
  v_user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'user_name',
    CASE
      WHEN NEW.raw_user_meta_data->>'given_name' IS NOT NULL
      THEN CONCAT(
        NEW.raw_user_meta_data->>'given_name',
        ' ',
        COALESCE(NEW.raw_user_meta_data->>'family_name', '')
      )
      ELSE NULL
    END,
    CASE WHEN NEW.phone IS NOT NULL THEN 'Phone User' ELSE NULL END,
    CASE WHEN NEW.email IS NOT NULL THEN SPLIT_PART(NEW.email, '@', 1) ELSE NULL END
  );

  -- Create ONLY the user profile
  -- Household + grocery list are created during onboarding
  INSERT INTO users (id, email, phone, name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    v_user_name
  );

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    RAISE LOG 'User % already exists in public.users', NEW.id;
    RETURN NEW;
  WHEN OTHERS THEN
    RAISE LOG 'Error creating user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
