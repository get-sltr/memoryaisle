-- Add category column to purchase_history for spending analytics
ALTER TABLE purchase_history ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';

-- Backfill existing rows with keyword-based categorization
UPDATE purchase_history SET category = CASE
  -- Dairy
  WHEN lower(item_name) ~ '(milk|cheese|butter|yogurt|eggs?|cream|cheddar|mozzarella)' THEN 'dairy'
  -- Produce
  WHEN lower(item_name) ~ '(apple|banana|orange|lettuce|tomato|potato|onion|carrot|broccoli|spinach|avocado|cucumber|pepper|garlic|lemon|lime|strawberr|blueberr|grape|mango|celery|kale|mushroom|zucchini|corn|pear|peach|melon|berry)' THEN 'produce'
  -- Meat (includes poultry, seafood, deli)
  WHEN lower(item_name) ~ '(beef|steak|pork|bacon|ham|sausage|lamb|ground|chicken|turkey|duck|fish|salmon|tuna|shrimp|crab|lobster|cod|tilapia|deli|salami|prosciutto|pastrami)' THEN 'meat'
  -- Bakery
  WHEN lower(item_name) ~ '(bread|bagel|muffin|croissant|cake|cookie|donut|roll|baguette|tortilla|pita)' THEN 'bakery'
  -- Pantry (includes frozen, beverages, breakfast, snacks, international)
  WHEN lower(item_name) ~ '(rice|pasta|flour|sugar|oil|sauce|soup|beans|canned|spice|frozen|ice cream|pizza|water|juice|soda|tea|wine|beer|cereal|oatmeal|pancake|waffle|syrup|coffee|granola|chips|candy|chocolate|popcorn|nuts|crackers|salsa|soy|curry|noodle|ramen|salt|vinegar|honey|jam|jelly|ketchup|mustard)' THEN 'pantry'
  -- Other (baby, household, etc.)
  ELSE 'other'
END
WHERE category IS NULL OR category = 'other';
