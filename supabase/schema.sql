-- ============================================
-- MEMORYAISLE - SUPABASE SCHEMA
-- ============================================
-- Run this in Supabase SQL Editor (supabase.com > Project > SQL Editor)
-- ============================================

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Households (must be created before users due to FK)
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_by UUID, -- Will be updated after users table exists
  invite_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK from households.created_by to users
ALTER TABLE households
ADD CONSTRAINT households_created_by_fkey
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Grocery Lists
CREATE TABLE grocery_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- List Items
CREATE TABLE list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES grocery_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ai_suggested', 'voice')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase History (from receipts, Plaid, loyalty cards)
CREATE TABLE purchase_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  normalized_name TEXT, -- Cleaned version for pattern matching
  price DECIMAL(10,2),
  store_name TEXT,
  purchased_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('receipt_ocr', 'plaid', 'loyalty')),
  raw_data JSONB, -- Store original OCR/Plaid response
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Patterns (AI-generated predictions)
CREATE TABLE purchase_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  avg_interval_days INTEGER NOT NULL,
  last_purchased TIMESTAMPTZ NOT NULL,
  next_predicted TIMESTAMPTZ NOT NULL,
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  purchase_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(household_id, item_name)
);

-- Store Locations (for geofencing)
CREATE TABLE store_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  place_id TEXT, -- Google Places ID
  geofence_radius_meters INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Users
CREATE INDEX idx_users_household ON users(household_id);
CREATE INDEX idx_users_email ON users(email);

-- Grocery Lists
CREATE INDEX idx_grocery_lists_household ON grocery_lists(household_id);
CREATE INDEX idx_grocery_lists_status ON grocery_lists(status);
CREATE INDEX idx_grocery_lists_household_status ON grocery_lists(household_id, status);

-- List Items
CREATE INDEX idx_list_items_list ON list_items(list_id);
CREATE INDEX idx_list_items_completed ON list_items(is_completed);
CREATE INDEX idx_list_items_list_completed ON list_items(list_id, is_completed);

-- Purchase History
CREATE INDEX idx_purchase_history_household ON purchase_history(household_id);
CREATE INDEX idx_purchase_history_item ON purchase_history(normalized_name);
CREATE INDEX idx_purchase_history_date ON purchase_history(purchased_at);
CREATE INDEX idx_purchase_history_household_item ON purchase_history(household_id, normalized_name);

-- Purchase Patterns
CREATE INDEX idx_purchase_patterns_household ON purchase_patterns(household_id);
CREATE INDEX idx_purchase_patterns_next ON purchase_patterns(next_predicted);

-- Store Locations
CREATE INDEX idx_store_locations_household ON store_locations(household_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_locations ENABLE ROW LEVEL SECURITY;

-- Helper function: Get user's household_id
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- USERS policies
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can view household members"
  ON users FOR SELECT
  USING (household_id = get_user_household_id());

-- HOUSEHOLDS policies
CREATE POLICY "Users can view own household"
  ON households FOR SELECT
  USING (id = get_user_household_id());

CREATE POLICY "Users can update own household"
  ON households FOR UPDATE
  USING (id = get_user_household_id());

CREATE POLICY "Authenticated users can create household"
  ON households FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- GROCERY_LISTS policies
CREATE POLICY "Users can view household lists"
  ON grocery_lists FOR SELECT
  USING (household_id = get_user_household_id());

CREATE POLICY "Users can create household lists"
  ON grocery_lists FOR INSERT
  WITH CHECK (household_id = get_user_household_id());

CREATE POLICY "Users can update household lists"
  ON grocery_lists FOR UPDATE
  USING (household_id = get_user_household_id());

CREATE POLICY "Users can delete household lists"
  ON grocery_lists FOR DELETE
  USING (household_id = get_user_household_id());

-- LIST_ITEMS policies
CREATE POLICY "Users can view household list items"
  ON list_items FOR SELECT
  USING (
    list_id IN (
      SELECT id FROM grocery_lists
      WHERE household_id = get_user_household_id()
    )
  );

CREATE POLICY "Users can create household list items"
  ON list_items FOR INSERT
  WITH CHECK (
    list_id IN (
      SELECT id FROM grocery_lists
      WHERE household_id = get_user_household_id()
    )
  );

CREATE POLICY "Users can update household list items"
  ON list_items FOR UPDATE
  USING (
    list_id IN (
      SELECT id FROM grocery_lists
      WHERE household_id = get_user_household_id()
    )
  );

CREATE POLICY "Users can delete household list items"
  ON list_items FOR DELETE
  USING (
    list_id IN (
      SELECT id FROM grocery_lists
      WHERE household_id = get_user_household_id()
    )
  );

-- PURCHASE_HISTORY policies
CREATE POLICY "Users can view household purchase history"
  ON purchase_history FOR SELECT
  USING (household_id = get_user_household_id());

CREATE POLICY "Users can create household purchase history"
  ON purchase_history FOR INSERT
  WITH CHECK (household_id = get_user_household_id());

-- PURCHASE_PATTERNS policies
CREATE POLICY "Users can view household patterns"
  ON purchase_patterns FOR SELECT
  USING (household_id = get_user_household_id());

CREATE POLICY "Users can manage household patterns"
  ON purchase_patterns FOR ALL
  USING (household_id = get_user_household_id());

-- STORE_LOCATIONS policies
CREATE POLICY "Users can view household stores"
  ON store_locations FOR SELECT
  USING (household_id = get_user_household_id());

CREATE POLICY "Users can manage household stores"
  ON store_locations FOR ALL
  USING (household_id = get_user_household_id());

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update completed_at when item is marked complete
CREATE OR REPLACE FUNCTION handle_item_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_completed = TRUE AND OLD.is_completed = FALSE THEN
    NEW.completed_at = NOW();
  ELSIF NEW.is_completed = FALSE THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_item_completed
  BEFORE UPDATE ON list_items
  FOR EACH ROW EXECUTE FUNCTION handle_item_completed();

-- Auto-update updated_at on purchase_patterns
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_pattern_updated
  BEFORE UPDATE ON purchase_patterns
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Normalize item names for pattern matching
CREATE OR REPLACE FUNCTION normalize_item_name(item_name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    TRIM(
      REGEXP_REPLACE(
        REGEXP_REPLACE(item_name, '\d+(\.\d+)?\s*(oz|lb|kg|g|ml|l|ct|pk|pack)\b', '', 'gi'),
        '\s+', ' ', 'g'
      )
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Auto-normalize item names on insert
CREATE OR REPLACE FUNCTION handle_purchase_normalize()
RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_name = normalize_item_name(NEW.item_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_purchase_insert
  BEFORE INSERT ON purchase_history
  FOR EACH ROW EXECUTE FUNCTION handle_purchase_normalize();

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================

-- Enable realtime for list_items (for household sync)
ALTER PUBLICATION supabase_realtime ADD TABLE list_items;
ALTER PUBLICATION supabase_realtime ADD TABLE grocery_lists;

-- ============================================
-- SEED DATA (Optional - for testing)
-- ============================================

-- Uncomment to create test data after signing up a test user:
/*
-- Create a test household
INSERT INTO households (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Test Family');

-- Create a test list
INSERT INTO grocery_lists (id, household_id, name, status)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Weekly Shopping', 'active');

-- Create test items
INSERT INTO list_items (list_id, name, quantity, source) VALUES
('00000000-0000-0000-0000-000000000002', 'Eggs', 1, 'manual'),
('00000000-0000-0000-0000-000000000002', 'Milk', 2, 'ai_suggested'),
('00000000-0000-0000-0000-000000000002', 'Bread', 1, 'manual'),
('00000000-0000-0000-0000-000000000002', 'Butter', 1, 'ai_suggested'),
('00000000-0000-0000-0000-000000000002', 'Bananas', 6, 'voice');
*/
