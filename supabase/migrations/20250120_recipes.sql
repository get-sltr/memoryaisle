-- ============================================
-- RECIPES TABLE MIGRATION
-- ============================================

-- Create recipes table
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '🍽️',
  description TEXT,
  prep_time TEXT,
  cook_time TEXT,
  total_time TEXT,
  servings INTEGER DEFAULT 4,
  ingredients JSONB DEFAULT '[]'::jsonb,
  instructions JSONB DEFAULT '[]'::jsonb,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'mira')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_recipes_household ON recipes(household_id);
CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_source ON recipes(source);

-- Enable RLS
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can manage recipes in their household
CREATE POLICY "Users can view household recipes"
  ON recipes FOR SELECT
  USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert household recipes"
  ON recipes FOR INSERT
  WITH CHECK (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update household recipes"
  ON recipes FOR UPDATE
  USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete household recipes"
  ON recipes FOR DELETE
  USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_recipes_updated_at ON recipes;
CREATE TRIGGER update_recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Recipes table created successfully!';
END $$;
