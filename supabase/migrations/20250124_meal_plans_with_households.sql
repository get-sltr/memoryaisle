-- ============================================
-- MEAL PLANS WITH HOUSEHOLDS DEPENDENCY
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PART 1: HOUSEHOLDS TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  invite_code TEXT UNIQUE DEFAULT substring(md5(random()::text), 1, 8),
  member_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on households
ALTER TABLE households ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe to run multiple times)
DROP POLICY IF EXISTS "Users can view own household" ON households;
DROP POLICY IF EXISTS "Users can create household" ON households;
DROP POLICY IF EXISTS "Users can update own household" ON households;

-- Users can see their household
CREATE POLICY "Users can view own household" ON households
  FOR SELECT USING (
    id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

-- Users can create a household
CREATE POLICY "Users can create household" ON households
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- Users can update their own household
CREATE POLICY "Users can update own household" ON households
  FOR UPDATE USING (
    id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

-- ============================================
-- PART 2: USERS TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  phone_verified BOOLEAN DEFAULT FALSE,
  phone_verified_at TIMESTAMPTZ,
  household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

-- Users can see their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- PART 3: AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_household_id UUID;
BEGIN
  -- Create a new household for the user
  INSERT INTO households (name, created_by)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'name', 'My') || '''s Household', NEW.id)
  RETURNING id INTO v_household_id;

  -- Create the user profile
  INSERT INTO users (id, email, name, household_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'name', NULL),
    v_household_id
  )
  ON CONFLICT (id) DO UPDATE SET
    household_id = COALESCE(users.household_id, v_household_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- PART 4: FIX EXISTING USERS WITHOUT HOUSEHOLDS
-- ============================================
-- Create households for existing users who don't have one
DO $$
DECLARE
  r RECORD;
  v_household_id UUID;
BEGIN
  FOR r IN
    SELECT au.id, au.email, au.raw_user_meta_data->>'name' as name
    FROM auth.users au
    LEFT JOIN users u ON u.id = au.id
    WHERE u.id IS NULL OR u.household_id IS NULL
  LOOP
    -- Check if user exists in users table
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = r.id) THEN
      -- Create household
      INSERT INTO households (name, created_by)
      VALUES (COALESCE(r.name, 'My') || '''s Household', r.id)
      RETURNING id INTO v_household_id;

      -- Create user profile
      INSERT INTO users (id, email, name, household_id)
      VALUES (r.id, COALESCE(r.email, ''), r.name, v_household_id);
    ELSE
      -- User exists but no household - create one
      INSERT INTO households (name, created_by)
      VALUES (COALESCE(r.name, 'My') || '''s Household', r.id)
      RETURNING id INTO v_household_id;

      -- Update user with household
      UPDATE users SET household_id = v_household_id WHERE id = r.id AND household_id IS NULL;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- PART 5: GROCERY LISTS (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS grocery_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Grocery List',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE grocery_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view household lists" ON grocery_lists;
DROP POLICY IF EXISTS "Users can insert household lists" ON grocery_lists;
DROP POLICY IF EXISTS "Users can update household lists" ON grocery_lists;
DROP POLICY IF EXISTS "Users can delete household lists" ON grocery_lists;

CREATE POLICY "Users can view household lists" ON grocery_lists
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert household lists" ON grocery_lists
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update household lists" ON grocery_lists
  FOR UPDATE USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete household lists" ON grocery_lists
  FOR DELETE USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

-- Create default grocery list for users without one
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT u.household_id
    FROM users u
    LEFT JOIN grocery_lists gl ON gl.household_id = u.household_id
    WHERE u.household_id IS NOT NULL AND gl.id IS NULL
    GROUP BY u.household_id
  LOOP
    INSERT INTO grocery_lists (household_id, name)
    VALUES (r.household_id, 'Grocery List');
  END LOOP;
END $$;

-- ============================================
-- PART 6: LIST ITEMS (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES grocery_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ai_suggested', 'voice', 'recipe', 'tradition')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view household items" ON list_items;
DROP POLICY IF EXISTS "Users can insert household items" ON list_items;
DROP POLICY IF EXISTS "Users can update household items" ON list_items;
DROP POLICY IF EXISTS "Users can delete household items" ON list_items;

CREATE POLICY "Users can view household items" ON list_items
  FOR SELECT USING (
    list_id IN (
      SELECT gl.id FROM grocery_lists gl
      WHERE gl.household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert household items" ON list_items
  FOR INSERT WITH CHECK (
    list_id IN (
      SELECT gl.id FROM grocery_lists gl
      WHERE gl.household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can update household items" ON list_items
  FOR UPDATE USING (
    list_id IN (
      SELECT gl.id FROM grocery_lists gl
      WHERE gl.household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete household items" ON list_items
  FOR DELETE USING (
    list_id IN (
      SELECT gl.id FROM grocery_lists gl
      WHERE gl.household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
    )
  );

-- ============================================
-- PART 7: MEAL PLANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Weekly Meal Plan',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PART 8: PLANNED MEALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS planned_meals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'dessert')),
  name TEXT NOT NULL,
  description TEXT,
  calories INTEGER,
  prep_time TEXT,
  ingredients JSONB DEFAULT '[]'::jsonb,
  instructions JSONB DEFAULT '[]'::jsonb,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE planned_meals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view household meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Users can insert household meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Users can update household meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Users can delete household meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Users can view household planned meals" ON planned_meals;
DROP POLICY IF EXISTS "Users can insert household planned meals" ON planned_meals;
DROP POLICY IF EXISTS "Users can update household planned meals" ON planned_meals;
DROP POLICY IF EXISTS "Users can delete household planned meals" ON planned_meals;

-- RLS Policies for meal_plans
CREATE POLICY "Users can view household meal plans" ON meal_plans
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert household meal plans" ON meal_plans
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update household meal plans" ON meal_plans
  FOR UPDATE USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete household meal plans" ON meal_plans
  FOR DELETE USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

-- RLS Policies for planned_meals
CREATE POLICY "Users can view household planned meals" ON planned_meals
  FOR SELECT USING (
    meal_plan_id IN (
      SELECT id FROM meal_plans
      WHERE household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert household planned meals" ON planned_meals
  FOR INSERT WITH CHECK (
    meal_plan_id IN (
      SELECT id FROM meal_plans
      WHERE household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can update household planned meals" ON planned_meals
  FOR UPDATE USING (
    meal_plan_id IN (
      SELECT id FROM meal_plans
      WHERE household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete household planned meals" ON planned_meals
  FOR DELETE USING (
    meal_plan_id IN (
      SELECT id FROM meal_plans
      WHERE household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
    )
  );

-- ============================================
-- PART 9: INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_household ON users(household_id);
CREATE INDEX IF NOT EXISTS idx_grocery_lists_household ON grocery_lists(household_id);
CREATE INDEX IF NOT EXISTS idx_list_items_list ON list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_list_items_completed ON list_items(is_completed);
CREATE INDEX IF NOT EXISTS idx_meal_plans_household ON meal_plans(household_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_dates ON meal_plans(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_planned_meals_plan ON planned_meals(meal_plan_id);
CREATE INDEX IF NOT EXISTS idx_planned_meals_date ON planned_meals(date);
