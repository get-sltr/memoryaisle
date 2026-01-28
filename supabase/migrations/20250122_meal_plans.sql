-- ============================================
-- MEAL PLANS - Store AI-generated meal plans
-- ============================================

-- Create meal_plans table
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

-- Create planned_meals table for individual meals in a plan
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_meal_plans_household ON meal_plans(household_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_dates ON meal_plans(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_planned_meals_plan ON planned_meals(meal_plan_id);
CREATE INDEX IF NOT EXISTS idx_planned_meals_date ON planned_meals(date);
