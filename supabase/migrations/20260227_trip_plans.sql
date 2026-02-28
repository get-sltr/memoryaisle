-- ============================================
-- TRIP PLANS - Persist AI-generated trip plans
-- Single table with JSONB for nested data
-- (checklists, meals, budget always read/written as whole units)
-- ============================================

CREATE TABLE IF NOT EXISTS trip_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'camping', 'road_trip', 'beach_vacation', 'mountain_getaway',
    'city_break', 'family_reunion', 'holiday_travel', 'day_trip',
    'picnic', 'tailgate', 'custom'
  )),
  destination TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration INTEGER NOT NULL CHECK (duration > 0 AND duration <= 365),
  travelers INTEGER NOT NULL CHECK (travelers > 0 AND travelers <= 50),
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN (
    'planning', 'ready', 'in_progress', 'completed'
  )),
  -- Nested data as JSONB (read/written as whole units)
  meals JSONB DEFAULT '[]'::jsonb,
  checklists JSONB DEFAULT '[]'::jsonb,
  shopping_list JSONB DEFAULT '[]'::jsonb,
  estimated_budget JSONB,
  -- Metadata
  mira_note TEXT,
  allergen_notes JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE trip_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies (all scoped to household)
CREATE POLICY "Users can view household trip plans" ON trip_plans
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert household trip plans" ON trip_plans
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update household trip plans" ON trip_plans
  FOR UPDATE USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete household trip plans" ON trip_plans
  FOR DELETE USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trip_plans_household ON trip_plans(household_id);
CREATE INDEX IF NOT EXISTS idx_trip_plans_status ON trip_plans(status);
CREATE INDEX IF NOT EXISTS idx_trip_plans_dates ON trip_plans(start_date, end_date);

-- Reuse existing handle_updated_at() trigger function
CREATE TRIGGER set_trip_plans_updated_at
  BEFORE UPDATE ON trip_plans
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
