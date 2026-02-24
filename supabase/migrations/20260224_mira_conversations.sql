-- Create mira_conversations table for persisting Mira chat history
-- Referenced by settings.tsx Clear Mira History and Save Conversation History toggle

CREATE TABLE IF NOT EXISTS mira_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by user
CREATE INDEX idx_mira_conversations_user_id ON mira_conversations(user_id);
CREATE INDEX idx_mira_conversations_created_at ON mira_conversations(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE mira_conversations ENABLE ROW LEVEL SECURITY;

-- Users can read their own conversations
CREATE POLICY "Users can view own conversations"
  ON mira_conversations FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own conversations
CREATE POLICY "Users can insert own conversations"
  ON mira_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own conversations (for Clear History)
CREATE POLICY "Users can delete own conversations"
  ON mira_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role full access on mira_conversations"
  ON mira_conversations FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
