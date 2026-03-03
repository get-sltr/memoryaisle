-- ============================================================
-- Sprint 5: Community Recipes
-- Public recipe sharing, saves, and ratings for discovery
-- ============================================================

-- 1. Add community columns to cookbook_recipes
ALTER TABLE cookbook_recipes ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE cookbook_recipes ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE cookbook_recipes ADD COLUMN IF NOT EXISTS save_count INT DEFAULT 0;
ALTER TABLE cookbook_recipes ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3,2) DEFAULT 0;
ALTER TABLE cookbook_recipes ADD COLUMN IF NOT EXISTS rating_count INT DEFAULT 0;

-- 2. Recipe Saves — track who saved which community recipe
CREATE TABLE IF NOT EXISTS recipe_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES cookbook_recipes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, recipe_id)
);

-- 3. Recipe Ratings — one rating per user per recipe
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cookbook_recipes_public ON cookbook_recipes(is_public, rating_avg DESC) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_cookbook_recipes_public_cuisine ON cookbook_recipes(cuisine, rating_avg DESC) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_recipe_saves_user ON recipe_saves(user_id);
CREATE INDEX IF NOT EXISTS idx_recipe_saves_recipe ON recipe_saves(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ratings_recipe ON recipe_ratings(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ratings_user ON recipe_ratings(user_id);

-- Enable RLS
ALTER TABLE recipe_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ratings ENABLE ROW LEVEL SECURITY;

-- RLS: Public recipes — anyone authenticated can read public recipes
CREATE POLICY "Anyone can view public recipes"
  ON cookbook_recipes FOR SELECT
  USING (is_public = TRUE);

-- RLS: Recipe Saves — users manage their own saves
CREATE POLICY "Users can view own saves"
  ON recipe_saves FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can save recipes"
  ON recipe_saves FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can unsave recipes"
  ON recipe_saves FOR DELETE
  USING (user_id = auth.uid());

-- RLS: Recipe Ratings — users manage their own, anyone can read
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

-- Function: Update recipe aggregate ratings after a rating change
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

-- Function: Update recipe save count after a save/unsave
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
