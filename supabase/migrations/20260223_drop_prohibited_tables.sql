-- Drop prohibited tables that could cause Apple App Store rejection
-- These tables are orphaned (no application code references them)

-- Drop dependent tables first (foreign keys)
DROP TABLE IF EXISTS promo_redemptions CASCADE;
DROP TABLE IF EXISTS founder_family_members CASCADE;

-- Drop parent tables
DROP TABLE IF EXISTS promo_codes CASCADE;
DROP TABLE IF EXISTS gift_cards CASCADE;
DROP TABLE IF EXISTS wallet_credits CASCADE;
DROP TABLE IF EXISTS founder_family_codes CASCADE;

-- Drop related RPC functions if they exist
DROP FUNCTION IF EXISTS generate_founder_family_code(text);
DROP FUNCTION IF EXISTS redeem_founder_family_code(text);
DROP FUNCTION IF EXISTS is_founder_family();
DROP FUNCTION IF EXISTS get_founder_family_codes();
