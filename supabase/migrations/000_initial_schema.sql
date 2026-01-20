-- ============================================
-- MemoryAisle Initial Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- HOUSEHOLDS
-- ============================================
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  invite_code TEXT UNIQUE DEFAULT substring(md5(random()::text), 1, 8),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USERS (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GROCERY LISTS
-- ============================================
CREATE TABLE IF NOT EXISTS grocery_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Grocery List',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LIST ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES grocery_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ai_suggested', 'voice')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PURCHASE PATTERNS (for Mira suggestions)
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  avg_interval_days INTEGER DEFAULT 7,
  last_purchased TIMESTAMPTZ DEFAULT NOW(),
  next_predicted TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  confidence DECIMAL(3,2) DEFAULT 0.3,
  purchase_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, item_name)
);

-- ============================================
-- PURCHASE HISTORY (from receipts)
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  price DECIMAL(10,2),
  store_name TEXT,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'receipt_ocr' CHECK (source IN ('receipt_ocr', 'plaid', 'loyalty')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_history ENABLE ROW LEVEL SECURITY;

-- Users can see their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Users can see their household
CREATE POLICY "Users can view own household" ON households
  FOR SELECT USING (
    id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

-- Users can see lists in their household
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

-- Users can manage items in their household lists
CREATE POLICY "Users can view household items" ON list_items
  FOR SELECT USING (
    list_id IN (
      SELECT gl.id FROM grocery_lists gl
      JOIN users u ON u.household_id = gl.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert household items" ON list_items
  FOR INSERT WITH CHECK (
    list_id IN (
      SELECT gl.id FROM grocery_lists gl
      JOIN users u ON u.household_id = gl.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can update household items" ON list_items
  FOR UPDATE USING (
    list_id IN (
      SELECT gl.id FROM grocery_lists gl
      JOIN users u ON u.household_id = gl.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete household items" ON list_items
  FOR DELETE USING (
    list_id IN (
      SELECT gl.id FROM grocery_lists gl
      JOIN users u ON u.household_id = gl.household_id
      WHERE u.id = auth.uid()
    )
  );

-- Purchase patterns - household members can view
CREATE POLICY "Users can view household patterns" ON purchase_patterns
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

-- Purchase history - household members can view and insert
CREATE POLICY "Users can view household history" ON purchase_history
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert household history" ON purchase_history
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

-- ============================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
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
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NULL),
    v_household_id
  );

  -- Create initial grocery list
  INSERT INTO grocery_lists (household_id, name)
  VALUES (v_household_id, 'Grocery List');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_household ON users(household_id);
CREATE INDEX IF NOT EXISTS idx_grocery_lists_household ON grocery_lists(household_id);
CREATE INDEX IF NOT EXISTS idx_list_items_list ON list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_list_items_completed ON list_items(is_completed);
CREATE INDEX IF NOT EXISTS idx_purchase_patterns_household ON purchase_patterns(household_id);
CREATE INDEX IF NOT EXISTS idx_purchase_patterns_next ON purchase_patterns(next_predicted);
CREATE INDEX IF NOT EXISTS idx_purchase_history_household ON purchase_history(household_id);
