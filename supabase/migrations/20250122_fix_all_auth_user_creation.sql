-- Fix user creation for ALL auth methods
-- Supports: Email, Phone (Twilio), Google, Facebook, Apple

-- Step 1: Make email nullable (phone users won't have email)
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Step 2: Add phone column to users table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'phone'
  ) THEN
    ALTER TABLE users ADD COLUMN phone TEXT;
  END IF;
END $$;

-- Step 3: Update the handle_new_user trigger to support ALL auth methods
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_household_id UUID;
  v_user_name TEXT;
BEGIN
  -- Get user name from various sources (OAuth providers use different fields)
  v_user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'user_name',
    -- For Apple Sign-In (may provide given_name/family_name separately)
    CASE
      WHEN NEW.raw_user_meta_data->>'given_name' IS NOT NULL
      THEN CONCAT(NEW.raw_user_meta_data->>'given_name', ' ', COALESCE(NEW.raw_user_meta_data->>'family_name', ''))
      ELSE NULL
    END,
    -- For phone-only signups
    CASE WHEN NEW.phone IS NOT NULL THEN 'Phone User' ELSE NULL END,
    -- For email signups, use email prefix
    CASE WHEN NEW.email IS NOT NULL THEN SPLIT_PART(NEW.email, '@', 1) ELSE NULL END
  );

  -- Create a new household for the user
  INSERT INTO households (name, created_by)
  VALUES (COALESCE(v_user_name, 'My') || '''s Household', NEW.id)
  RETURNING id INTO v_household_id;

  -- Create the user profile
  INSERT INTO users (id, email, phone, name, household_id)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    v_user_name,
    v_household_id
  );

  -- Create initial grocery list
  INSERT INTO grocery_lists (household_id, name)
  VALUES (v_household_id, 'Grocery List');

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- User already exists (shouldn't happen, but handle gracefully)
    RAISE LOG 'User % already exists in public.users', NEW.id;
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth signup
    RAISE LOG 'Error creating user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
