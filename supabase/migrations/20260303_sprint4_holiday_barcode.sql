-- ============================================================
-- Sprint 4: Holiday Planner + Barcode Scanner
-- Differentiation features for cultural holiday planning and quick pantry entry
-- ============================================================

-- 1. Holiday Plans — special meal plans with holiday-specific fields
CREATE TABLE IF NOT EXISTS holiday_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  holiday_name TEXT NOT NULL,                      -- 'Thanksgiving', 'Eid al-Fitr', 'Lunar New Year', etc.
  holiday_date DATE NOT NULL,
  guest_count INT DEFAULT 0,
  dietary_notes TEXT,                              -- guest dietary restrictions
  menu JSONB NOT NULL DEFAULT '[]',                -- array of {meal, dishes: [{name, servings, ingredients}]}
  shopping_list JSONB NOT NULL DEFAULT '[]',       -- array of ingredient strings with quantities
  prep_timeline JSONB NOT NULL DEFAULT '[]',       -- array of {days_before, tasks: [string]}
  budget_estimate DECIMAL(10,2),
  actual_spent DECIMAL(10,2),
  notes TEXT,
  status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'shopping', 'prepping', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Scanned Products — barcode lookup cache to avoid repeated API calls
CREATE TABLE IF NOT EXISTS scanned_products (
  barcode TEXT PRIMARY KEY,
  product_name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  image_url TEXT,
  nutrition JSONB,                                 -- basic nutrition data from Open Food Facts
  last_fetched TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_holiday_plans_household ON holiday_plans(household_id);
CREATE INDEX IF NOT EXISTS idx_holiday_plans_date ON holiday_plans(household_id, holiday_date);
CREATE INDEX IF NOT EXISTS idx_holiday_plans_status ON holiday_plans(household_id, status);

-- Enable RLS
ALTER TABLE holiday_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanned_products ENABLE ROW LEVEL SECURITY;

-- RLS: Holiday Plans — household members can view/manage
CREATE POLICY "Users can view household holiday plans"
  ON holiday_plans FOR SELECT
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert household holiday plans"
  ON holiday_plans FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update household holiday plans"
  ON holiday_plans FOR UPDATE
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete household holiday plans"
  ON holiday_plans FOR DELETE
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

-- RLS: Scanned Products — anyone authenticated can read/write (shared cache)
CREATE POLICY "Authenticated users can read scanned products"
  ON scanned_products FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert scanned products"
  ON scanned_products FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Auto-update timestamps
CREATE TRIGGER holiday_plans_updated_at
  BEFORE UPDATE ON holiday_plans
  FOR EACH ROW EXECUTE FUNCTION update_glp1_updated_at();
