-- ============================================
-- FIX SIGNUP TRIGGER
-- Combines user profile + subscription creation
-- ============================================

-- Drop ALL existing user creation triggers to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;

-- Create unified function that handles everything
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_household_id UUID;
BEGIN
  -- Step 1: Create a new household for the user
  INSERT INTO households (name, created_by)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'name', 'My') || '''s Household', NEW.id)
  RETURNING id INTO v_household_id;

  -- Step 2: Create the user profile
  INSERT INTO users (id, email, name, household_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'name', NULL),
    v_household_id
  )
  ON CONFLICT (id) DO UPDATE SET
    household_id = COALESCE(users.household_id, v_household_id),
    email = COALESCE(NEW.email, users.email);

  -- Step 3: Create free subscription
  INSERT INTO subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'free', 'none')
  ON CONFLICT (user_id) DO NOTHING;

  -- Step 4: Create default grocery list
  INSERT INTO grocery_lists (household_id, name)
  VALUES (v_household_id, 'Grocery List');

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the signup
    RAISE WARNING 'handle_new_user error for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create single unified trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
