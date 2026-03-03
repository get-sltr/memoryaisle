-- ============================================================
-- Sprint 1: Meal Memories + Blog
-- Photo album for family food moments + in-app blog feed
--
-- meal_memories: household-scoped (family photos shared)
-- blog_posts: admin-managed content (no user writes)
-- ============================================================

-- 1. Meal Memories — family food photo album
CREATE TABLE IF NOT EXISTS meal_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,                -- S3 CDN URL
  caption TEXT,                           -- user description
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,  -- optional link to recipe
  meal_plan_id UUID,                      -- optional link to meal plan
  holiday TEXT,                           -- e.g. 'eid_2026', 'thanksgiving_2026', 'christmas_2026'
  tags TEXT[] DEFAULT '{}',               -- user tags: ['dinner', 'baking', 'family']
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Blog Posts — curated content served from S3
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,              -- URL-friendly: 'halal-thanksgiving-recipes'
  excerpt TEXT,                           -- short preview text
  content_url TEXT,                       -- S3 URL for full markdown content
  cover_image_url TEXT,                   -- S3 CDN URL for cover image
  category TEXT NOT NULL DEFAULT 'general', -- 'seasonal_recipes', 'meal_prep', 'holiday_planning', etc.
  tags TEXT[] DEFAULT '{}',
  author TEXT DEFAULT 'MemoryAisle',
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meal_memories_household ON meal_memories(household_id);
CREATE INDEX IF NOT EXISTS idx_meal_memories_user ON meal_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_memories_created ON meal_memories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_memories_holiday ON meal_memories(holiday) WHERE holiday IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published_at DESC) WHERE is_published = TRUE;

-- Enable RLS
ALTER TABLE meal_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- RLS: Meal Memories — household members can view/manage
CREATE POLICY "Users can view household memories"
  ON meal_memories FOR SELECT
  USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

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

-- RLS: Blog Posts — anyone authenticated can read published posts
CREATE POLICY "Authenticated users can read published posts"
  ON blog_posts FOR SELECT
  USING (is_published = TRUE);

-- Auto-update timestamps
CREATE TRIGGER meal_memories_updated_at
  BEFORE UPDATE ON meal_memories
  FOR EACH ROW EXECUTE FUNCTION update_glp1_updated_at();

CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_glp1_updated_at();

-- Add avatar_url column to users table for profile photos
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
