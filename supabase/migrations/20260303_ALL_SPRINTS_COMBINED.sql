-- ============================================================
-- ALL SPRINTS COMBINED (1-5) — Run this as a single query
-- ============================================================

-- ============================================================
-- SPRINT 1: Meal Memories + Blog
-- ============================================================

CREATE TABLE IF NOT EXISTS meal_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  recipe_id UUID,
  meal_plan_id UUID,
  holiday TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content_url TEXT,
  cover_image_url TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  author TEXT DEFAULT 'MemoryAisle',
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meal_memories_household ON meal_memories(household_id);
CREATE INDEX IF NOT EXISTS idx_meal_memories_user ON meal_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_memories_created ON meal_memories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_memories_holiday ON meal_memories(holiday) WHERE holiday IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published_at DESC) WHERE is_published = TRUE;

ALTER TABLE meal_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view household memories"
  ON meal_memories FOR SELECT
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert household memories"
  ON meal_memories FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update own memories"
  ON meal_memories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own memories"
  ON meal_memories FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can read published posts"
  ON blog_posts FOR SELECT
  USING (is_published = TRUE);

CREATE TRIGGER meal_memories_updated_at
  BEFORE UPDATE ON meal_memories
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ============================================================
-- SPRINT 2: Pantry Inventory + Smart Budget Tracker
-- ============================================================

CREATE TABLE IF NOT EXISTS pantry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  category TEXT DEFAULT 'other',
  quantity DECIMAL(10,2) DEFAULT 1,
  unit TEXT DEFAULT 'item',
  added_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estimated_expiry DATE,
  auto_replenish BOOLEAN DEFAULT FALSE,
  avg_consumption_days INT,
  last_restocked TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(household_id, item_name)
);

CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('weekly', 'monthly')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(household_id, period)
);

CREATE INDEX IF NOT EXISTS idx_pantry_items_household ON pantry_items(household_id);
CREATE INDEX IF NOT EXISTS idx_pantry_items_expiry ON pantry_items(estimated_expiry) WHERE estimated_expiry IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pantry_items_category ON pantry_items(household_id, category);
CREATE INDEX IF NOT EXISTS idx_budgets_household ON budgets(household_id);

ALTER TABLE pantry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

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

CREATE TRIGGER pantry_items_updated_at
  BEFORE UPDATE ON pantry_items
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER budgets_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- SPRINT 3: Family Cookbook + Weekly Digest
-- ============================================================

CREATE TABLE IF NOT EXISTS cookbook_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]',
  instructions JSONB NOT NULL DEFAULT '[]',
  prep_time TEXT,
  cook_time TEXT,
  servings INT,
  calories INT,
  protein TEXT,
  carbs TEXT,
  fat TEXT,
  cuisine TEXT,
  dietary_tags TEXT[] DEFAULT '{}',
  photo_urls TEXT[] DEFAULT '{}',
  source TEXT DEFAULT 'manual',
  source_memory_id UUID,
  is_favorite BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS weekly_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  digest_data JSONB NOT NULL DEFAULT '{}',
  email_sent BOOLEAN DEFAULT FALSE,
  push_sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_cookbook_recipes_household ON cookbook_recipes(household_id);
CREATE INDEX IF NOT EXISTS idx_cookbook_recipes_cuisine ON cookbook_recipes(household_id, cuisine);
CREATE INDEX IF NOT EXISTS idx_cookbook_recipes_source ON cookbook_recipes(household_id, source);
CREATE INDEX IF NOT EXISTS idx_cookbook_recipes_favorite ON cookbook_recipes(household_id, is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_cookbook_recipes_search ON cookbook_recipes USING gin (to_tsvector('english', title || ' ' || COALESCE(description, '')));
CREATE INDEX IF NOT EXISTS idx_weekly_digests_user ON weekly_digests(user_id, week_start DESC);

ALTER TABLE cookbook_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_digests ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Users can view own digests"
  ON weekly_digests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service can insert digests"
  ON weekly_digests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER cookbook_recipes_updated_at
  BEFORE UPDATE ON cookbook_recipes
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- SPRINT 4: Holiday Planner + Barcode Scanner
-- ============================================================

CREATE TABLE IF NOT EXISTS holiday_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  holiday_name TEXT NOT NULL,
  holiday_date DATE NOT NULL,
  guest_count INT DEFAULT 0,
  dietary_notes TEXT,
  menu JSONB NOT NULL DEFAULT '[]',
  shopping_list JSONB NOT NULL DEFAULT '[]',
  prep_timeline JSONB NOT NULL DEFAULT '[]',
  budget_estimate DECIMAL(10,2),
  actual_spent DECIMAL(10,2),
  notes TEXT,
  status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'shopping', 'prepping', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scanned_products (
  barcode TEXT PRIMARY KEY,
  product_name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  image_url TEXT,
  nutrition JSONB,
  last_fetched TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holiday_plans_household ON holiday_plans(household_id);
CREATE INDEX IF NOT EXISTS idx_holiday_plans_date ON holiday_plans(household_id, holiday_date);
CREATE INDEX IF NOT EXISTS idx_holiday_plans_status ON holiday_plans(household_id, status);

ALTER TABLE holiday_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanned_products ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Authenticated users can read scanned products"
  ON scanned_products FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert scanned products"
  ON scanned_products FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE TRIGGER holiday_plans_updated_at
  BEFORE UPDATE ON holiday_plans
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- SPRINT 5: Community Recipes
-- ============================================================

ALTER TABLE cookbook_recipes ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE cookbook_recipes ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE cookbook_recipes ADD COLUMN IF NOT EXISTS save_count INT DEFAULT 0;
ALTER TABLE cookbook_recipes ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3,2) DEFAULT 0;
ALTER TABLE cookbook_recipes ADD COLUMN IF NOT EXISTS rating_count INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS recipe_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES cookbook_recipes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, recipe_id)
);

CREATE TABLE IF NOT EXISTS recipe_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES cookbook_recipes(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, recipe_id)
);

CREATE INDEX IF NOT EXISTS idx_cookbook_recipes_public ON cookbook_recipes(is_public, rating_avg DESC) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_cookbook_recipes_public_cuisine ON cookbook_recipes(cuisine, rating_avg DESC) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_recipe_saves_user ON recipe_saves(user_id);
CREATE INDEX IF NOT EXISTS idx_recipe_saves_recipe ON recipe_saves(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ratings_recipe ON recipe_ratings(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ratings_user ON recipe_ratings(user_id);

ALTER TABLE recipe_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public recipes"
  ON cookbook_recipes FOR SELECT
  USING (is_public = TRUE);

CREATE POLICY "Users can view own saves"
  ON recipe_saves FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can save recipes"
  ON recipe_saves FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can unsave recipes"
  ON recipe_saves FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Anyone can view ratings"
  ON recipe_ratings FOR SELECT
  USING (TRUE);

CREATE POLICY "Users can rate recipes"
  ON recipe_ratings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own ratings"
  ON recipe_ratings FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own ratings"
  ON recipe_ratings FOR DELETE
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION update_recipe_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cookbook_recipes SET
    rating_avg = COALESCE((SELECT AVG(rating)::NUMERIC(3,2) FROM recipe_ratings WHERE recipe_id = COALESCE(NEW.recipe_id, OLD.recipe_id)), 0),
    rating_count = (SELECT COUNT(*) FROM recipe_ratings WHERE recipe_id = COALESCE(NEW.recipe_id, OLD.recipe_id))
  WHERE id = COALESCE(NEW.recipe_id, OLD.recipe_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER recipe_rating_stats_trigger
  AFTER INSERT OR UPDATE OR DELETE ON recipe_ratings
  FOR EACH ROW EXECUTE FUNCTION update_recipe_rating_stats();

CREATE OR REPLACE FUNCTION update_recipe_save_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cookbook_recipes SET
    save_count = (SELECT COUNT(*) FROM recipe_saves WHERE recipe_id = COALESCE(NEW.recipe_id, OLD.recipe_id))
  WHERE id = COALESCE(NEW.recipe_id, OLD.recipe_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER recipe_save_count_trigger
  AFTER INSERT OR DELETE ON recipe_saves
  FOR EACH ROW EXECUTE FUNCTION update_recipe_save_count();
