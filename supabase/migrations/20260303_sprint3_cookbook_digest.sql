-- ============================================================
-- Sprint 3: Family Cookbook + Weekly Digest
-- Engagement loop features for retention and family investment
-- ============================================================

-- 1. Cookbook Recipes — family recipe collection
CREATE TABLE IF NOT EXISTS cookbook_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]',        -- array of ingredient strings
  instructions JSONB NOT NULL DEFAULT '[]',       -- array of instruction strings
  prep_time TEXT,                                  -- '10 min'
  cook_time TEXT,                                  -- '30 min'
  servings INT,
  calories INT,
  protein TEXT,
  carbs TEXT,
  fat TEXT,
  cuisine TEXT,                                    -- 'Italian', 'Indian', 'Mexican', etc.
  dietary_tags TEXT[] DEFAULT '{}',                -- 'vegetarian', 'vegan', 'gluten-free', 'halal', 'kosher'
  photo_urls TEXT[] DEFAULT '{}',                  -- S3/CloudFront URLs from meal memories
  source TEXT DEFAULT 'manual',                    -- 'manual', 'mira', 'import'
  source_memory_id UUID REFERENCES meal_memories(id) ON DELETE SET NULL,
  is_favorite BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Weekly Digests — generated weekly summaries
CREATE TABLE IF NOT EXISTS weekly_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,                        -- Monday of the digest week
  week_end DATE NOT NULL,                          -- Sunday of the digest week
  digest_data JSONB NOT NULL DEFAULT '{}',         -- full digest payload
  email_sent BOOLEAN DEFAULT FALSE,
  push_sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, week_start)                      -- one digest per user per week
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cookbook_recipes_household ON cookbook_recipes(household_id);
CREATE INDEX IF NOT EXISTS idx_cookbook_recipes_cuisine ON cookbook_recipes(household_id, cuisine);
CREATE INDEX IF NOT EXISTS idx_cookbook_recipes_source ON cookbook_recipes(household_id, source);
CREATE INDEX IF NOT EXISTS idx_cookbook_recipes_favorite ON cookbook_recipes(household_id, is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_cookbook_recipes_search ON cookbook_recipes USING gin (to_tsvector('english', title || ' ' || COALESCE(description, '')));
CREATE INDEX IF NOT EXISTS idx_weekly_digests_user ON weekly_digests(user_id, week_start DESC);

-- Enable RLS
ALTER TABLE cookbook_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_digests ENABLE ROW LEVEL SECURITY;

-- RLS: Cookbook Recipes — household members can view/manage
CREATE POLICY "Users can view household cookbook"
  ON cookbook_recipes FOR SELECT
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert household recipes"
  ON cookbook_recipes FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update household recipes"
  ON cookbook_recipes FOR UPDATE
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete household recipes"
  ON cookbook_recipes FOR DELETE
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

-- RLS: Weekly Digests — users can only see their own
CREATE POLICY "Users can view own digests"
  ON weekly_digests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service can insert digests"
  ON weekly_digests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Auto-update timestamps
CREATE TRIGGER cookbook_recipes_updated_at
  BEFORE UPDATE ON cookbook_recipes
  FOR EACH ROW EXECUTE FUNCTION update_glp1_updated_at();
