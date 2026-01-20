-- ============================================
-- Wallet Features Migration
-- Adds support for loyalty cards, credits, promos, and gift cards
-- ============================================

-- ============================================
-- ADD MEMBER_COUNT TO HOUSEHOLDS
-- ============================================
ALTER TABLE households
ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT NULL;

-- ============================================
-- LOYALTY CARDS
-- ============================================
CREATE TABLE IF NOT EXISTS loyalty_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  card_number TEXT,
  barcode TEXT,
  barcode_format TEXT DEFAULT 'CODE128',
  points_balance INTEGER DEFAULT 0,
  rewards_balance DECIMAL(10,2) DEFAULT 0,
  last_used TIMESTAMPTZ,
  color TEXT DEFAULT '#0071ce',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WALLET CREDITS
-- User credits that can be earned or purchased
-- ============================================
CREATE TABLE IF NOT EXISTS wallet_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earned', 'purchased', 'referral', 'promo', 'refund')),
  description TEXT,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROMO CODES
-- Track promotional codes and their redemptions
-- ============================================
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'credit')),
  discount_value DECIMAL(10,2) NOT NULL,
  min_purchase DECIMAL(10,2),
  max_uses INTEGER,
  uses_count INTEGER DEFAULT 0,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL = global promo
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER PROMO REDEMPTIONS
-- Track which users redeemed which promos
-- ============================================
CREATE TABLE IF NOT EXISTS promo_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, promo_code_id)
);

-- ============================================
-- GIFT CARDS
-- User-owned gift cards (store or app gift cards)
-- ============================================
CREATE TABLE IF NOT EXISTS gift_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_type TEXT NOT NULL CHECK (card_type IN ('store', 'app')),
  store_name TEXT, -- For store gift cards
  card_number TEXT,
  pin TEXT,
  initial_balance DECIMAL(10,2) NOT NULL,
  current_balance DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORDERS (for order history)
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  store_name TEXT NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  items_count INTEGER DEFAULT 0,
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE loyalty_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Loyalty Cards - Users can manage their own cards
CREATE POLICY "Users can view own loyalty cards" ON loyalty_cards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own loyalty cards" ON loyalty_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own loyalty cards" ON loyalty_cards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own loyalty cards" ON loyalty_cards
  FOR DELETE USING (auth.uid() = user_id);

-- Wallet Credits - Users can view their own credits
CREATE POLICY "Users can view own credits" ON wallet_credits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credits" ON wallet_credits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Promo Codes - Users can view active global promos or their own
CREATE POLICY "Users can view active promos" ON promo_codes
  FOR SELECT USING (
    is_active = TRUE AND (
      user_id IS NULL OR
      user_id = auth.uid()
    )
  );

-- Promo Redemptions - Users can manage their own
CREATE POLICY "Users can view own redemptions" ON promo_redemptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own redemptions" ON promo_redemptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Gift Cards - Users can manage their own cards
CREATE POLICY "Users can view own gift cards" ON gift_cards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gift cards" ON gift_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gift cards" ON gift_cards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own gift cards" ON gift_cards
  FOR DELETE USING (auth.uid() = user_id);

-- Orders - Users can view their own orders
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_user ON loyalty_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_store ON loyalty_cards(store_name);
CREATE INDEX IF NOT EXISTS idx_wallet_credits_user ON wallet_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_credits_expires ON wallet_credits(expires_at);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_valid ON promo_codes(valid_until);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user ON promo_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_gift_cards_user ON gift_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_gift_cards_active ON gift_cards(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Update timestamp trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_loyalty_cards_updated_at ON loyalty_cards;
CREATE TRIGGER update_loyalty_cards_updated_at
  BEFORE UPDATE ON loyalty_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_gift_cards_updated_at ON gift_cards;
CREATE TRIGGER update_gift_cards_updated_at
  BEFORE UPDATE ON gift_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
