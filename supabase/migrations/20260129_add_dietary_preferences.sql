-- Add dietary/religious preference columns to households
ALTER TABLE households ADD COLUMN IF NOT EXISTS family_profile JSONB DEFAULT '{}';
ALTER TABLE households ADD COLUMN IF NOT EXISTS dietary_preferences TEXT[] DEFAULT '{}';
ALTER TABLE households ADD COLUMN IF NOT EXISTS cultural_preferences TEXT[] DEFAULT '{}';

-- Add dietary columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS allergies TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS dietary_preferences TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile JSONB DEFAULT '{}';

-- Create family_members table
CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'other',
  allergies TEXT[] DEFAULT '{}',
  dietary_preferences TEXT[] DEFAULT '{}',
  profile JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on family_members
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for family_members
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'family_members' AND policyname = 'Users can view household family members'
  ) THEN
    CREATE POLICY "Users can view household family members"
      ON family_members FOR SELECT
      USING (household_id IN (
        SELECT household_id FROM users WHERE id = auth.uid()
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'family_members' AND policyname = 'Users can manage household family members'
  ) THEN
    CREATE POLICY "Users can manage household family members"
      ON family_members FOR ALL
      USING (household_id IN (
        SELECT household_id FROM users WHERE id = auth.uid()
      ));
  END IF;
END $$;

-- Index for efficient household lookups
CREATE INDEX IF NOT EXISTS idx_family_members_household ON family_members(household_id);
