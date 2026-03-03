-- ============================================================
-- Sprint 2: Pantry Inventory + Smart Budget Tracker
-- Household-scoped features for kitchen management and spending
-- ============================================================

-- 1. Pantry Items — running kitchen inventory
CREATE TABLE IF NOT EXISTS pantry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  category TEXT DEFAULT 'other',           -- dairy, produce, meat, bakery, pantry, other
  quantity DECIMAL(10,2) DEFAULT 1,
  unit TEXT DEFAULT 'item',                -- item, lb, oz, kg, g, L, mL, cup, bag, box, can, bottle, bunch
  added_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estimated_expiry DATE,                   -- nullable, user can set
  auto_replenish BOOLEAN DEFAULT FALSE,    -- when true, Mira suggests adding to list when low
  avg_consumption_days INT,                -- estimated days to consume (learned over time)
  last_restocked TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(household_id, item_name)          -- one entry per item per household
);

-- 2. Budgets — grocery spending targets
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,           -- budget amount in USD
  period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('weekly', 'monthly')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(household_id, period)             -- one active budget per period type per household
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pantry_items_household ON pantry_items(household_id);
CREATE INDEX IF NOT EXISTS idx_pantry_items_expiry ON pantry_items(estimated_expiry) WHERE estimated_expiry IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pantry_items_category ON pantry_items(household_id, category);
CREATE INDEX IF NOT EXISTS idx_budgets_household ON budgets(household_id);

-- Enable RLS
ALTER TABLE pantry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- RLS: Pantry Items — household members can view/manage
CREATE POLICY "Users can view household pantry"
  ON pantry_items FOR SELECT
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert household pantry items"
  ON pantry_items FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update household pantry items"
  ON pantry_items FOR UPDATE
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete household pantry items"
  ON pantry_items FOR DELETE
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

-- RLS: Budgets — household members can view/manage
CREATE POLICY "Users can view household budgets"
  ON budgets FOR SELECT
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert household budgets"
  ON budgets FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update household budgets"
  ON budgets FOR UPDATE
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete household budgets"
  ON budgets FOR DELETE
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

-- Auto-update timestamps (reuse existing trigger function)
CREATE TRIGGER pantry_items_updated_at
  BEFORE UPDATE ON pantry_items
  FOR EACH ROW EXECUTE FUNCTION update_glp1_updated_at();

CREATE TRIGGER budgets_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION update_glp1_updated_at();
