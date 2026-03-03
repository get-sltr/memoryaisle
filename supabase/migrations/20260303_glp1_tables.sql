-- ============================================================
-- GLP-1 Adaptive Meal Planning Tables
-- Phase 2 Feature: Cycle-aware meal adjustments for GLP-1 users
--
-- 3 tables, all user-owned (NOT household-scoped — medication is personal)
-- RLS: auth.uid() = user_id on all tables
-- ============================================================

-- 1. GLP-1 Profiles — medication info and preferences
CREATE TABLE IF NOT EXISTS glp1_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication TEXT NOT NULL,              -- 'ozempic', 'mounjaro', 'wegovy', 'saxenda', 'zepbound', 'rybelsus'
  dose TEXT,                             -- medication-specific dose string e.g. '0.25mg', '2.5mg'
  injection_day INT,                     -- 0=Sunday..6=Saturday (NULL for daily meds like Rybelsus)
  duration TEXT NOT NULL DEFAULT 'less_than_1_month', -- 'less_than_1_month', '1_3_months', '3_6_months', '6_12_months', '1_year_plus'
  food_triggers TEXT[] DEFAULT '{}',     -- user-reported trigger foods e.g. ['greasy food', 'dairy', 'spicy']
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)                        -- one active profile per user
);

-- 2. Injection Log — tracks each injection event
CREATE TABLE IF NOT EXISTS glp1_injection_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  injection_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dose TEXT,                             -- dose at time of injection
  injection_site TEXT,                   -- 'left_abdomen', 'right_abdomen', 'left_thigh', 'right_thigh', 'upper_arm'
  side_effects TEXT[] DEFAULT '{}',      -- ['nausea', 'headache', 'fatigue', 'injection_site_pain', 'diarrhea', 'constipation']
  appetite_level INT CHECK (appetite_level BETWEEN 1 AND 5), -- 1=no appetite, 5=very hungry
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Daily Logs — daily wellness check-in (unique per user per date)
CREATE TABLE IF NOT EXISTS glp1_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  appetite INT CHECK (appetite BETWEEN 1 AND 5),           -- 1=no appetite, 5=very hungry
  nausea INT CHECK (nausea BETWEEN 0 AND 5),               -- 0=none, 5=severe
  energy INT CHECK (energy BETWEEN 1 AND 5),               -- 1=exhausted, 5=energized
  protein_servings INT DEFAULT 0,
  water_glasses INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, log_date)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_glp1_profiles_user ON glp1_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_glp1_injection_log_user_date ON glp1_injection_log(user_id, injection_date DESC);
CREATE INDEX IF NOT EXISTS idx_glp1_daily_logs_user_date ON glp1_daily_logs(user_id, log_date DESC);

-- Enable RLS
ALTER TABLE glp1_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE glp1_injection_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE glp1_daily_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access their own data
CREATE POLICY "Users manage own GLP-1 profile"
  ON glp1_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own injection log"
  ON glp1_injection_log FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own daily logs"
  ON glp1_daily_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_glp1_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER glp1_profiles_updated_at
  BEFORE UPDATE ON glp1_profiles
  FOR EACH ROW EXECUTE FUNCTION update_glp1_updated_at();

CREATE TRIGGER glp1_daily_logs_updated_at
  BEFORE UPDATE ON glp1_daily_logs
  FOR EACH ROW EXECUTE FUNCTION update_glp1_updated_at();
