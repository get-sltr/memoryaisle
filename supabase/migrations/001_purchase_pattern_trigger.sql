-- ============================================
-- HELPER: Normalize item names for matching
-- ============================================
-- Converts item names to a normalized form for pattern matching
-- e.g., "Organic Milk 2%" -> "milk", "BREAD (Whole Wheat)" -> "bread whole wheat"

CREATE OR REPLACE FUNCTION normalize_item_name(item_name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    TRIM(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(item_name, '\s*\([^)]*\)\s*', ' ', 'g'),  -- Remove parenthetical content
          '[^a-zA-Z0-9\s]', '', 'g'                                  -- Remove special chars
        ),
        '\s+', ' ', 'g'                                              -- Normalize whitespace
      )
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- AUTO-POPULATE PURCHASE PATTERNS
-- ============================================
-- When an item is completed, update or create a purchase pattern

CREATE OR REPLACE FUNCTION update_purchase_pattern()
RETURNS TRIGGER AS $$
DECLARE
  v_household_id UUID;
  v_normalized_name TEXT;
  v_existing_pattern RECORD;
  v_last_purchased TIMESTAMPTZ;
  v_days_since_last INTEGER;
  v_new_avg_interval INTEGER;
  v_new_confidence DECIMAL(3,2);
BEGIN
  -- Only trigger on completion (is_completed changed to TRUE)
  IF NEW.is_completed = TRUE AND (OLD.is_completed = FALSE OR OLD.is_completed IS NULL) THEN

    -- Get household_id from the list
    SELECT gl.household_id INTO v_household_id
    FROM grocery_lists gl
    WHERE gl.id = NEW.list_id;

    -- Normalize the item name for pattern matching
    v_normalized_name = normalize_item_name(NEW.name);

    -- Check for existing pattern
    SELECT * INTO v_existing_pattern
    FROM purchase_patterns
    WHERE household_id = v_household_id
      AND normalize_item_name(item_name) = v_normalized_name;

    IF v_existing_pattern.id IS NOT NULL THEN
      -- Update existing pattern
      v_last_purchased := v_existing_pattern.last_purchased;
      v_days_since_last := EXTRACT(DAY FROM (NOW() - v_last_purchased))::INTEGER;

      -- Only update if at least 1 day has passed (avoid duplicates)
      IF v_days_since_last >= 1 THEN
        -- Calculate new average interval (weighted average)
        v_new_avg_interval := (
          (v_existing_pattern.avg_interval_days * v_existing_pattern.purchase_count + v_days_since_last) /
          (v_existing_pattern.purchase_count + 1)
        )::INTEGER;

        -- Increase confidence with more data points (max 0.95)
        v_new_confidence := LEAST(0.95, v_existing_pattern.confidence + 0.05);

        UPDATE purchase_patterns
        SET
          avg_interval_days = GREATEST(1, v_new_avg_interval),
          last_purchased = NOW(),
          next_predicted = NOW() + (GREATEST(1, v_new_avg_interval) || ' days')::INTERVAL,
          confidence = v_new_confidence,
          purchase_count = purchase_count + 1,
          updated_at = NOW()
        WHERE id = v_existing_pattern.id;
      END IF;

    ELSE
      -- Create new pattern with default 7-day interval
      INSERT INTO purchase_patterns (
        household_id,
        item_name,
        avg_interval_days,
        last_purchased,
        next_predicted,
        confidence,
        purchase_count
      ) VALUES (
        v_household_id,
        NEW.name,  -- Use original name for display
        7,         -- Default interval
        NOW(),
        NOW() + INTERVAL '7 days',
        0.3,       -- Low initial confidence
        1
      )
      ON CONFLICT (household_id, item_name) DO NOTHING;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_item_completed_pattern ON list_items;
CREATE TRIGGER on_item_completed_pattern
  AFTER UPDATE ON list_items
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_pattern();

-- Also trigger on insert if item is already completed (rare but possible)
DROP TRIGGER IF EXISTS on_item_insert_completed_pattern ON list_items;
CREATE TRIGGER on_item_insert_completed_pattern
  AFTER INSERT ON list_items
  FOR EACH ROW
  WHEN (NEW.is_completed = TRUE)
  EXECUTE FUNCTION update_purchase_pattern();

-- ============================================
-- HELPER: Get items due for repurchase
-- ============================================
CREATE OR REPLACE FUNCTION get_due_items(p_household_id UUID)
RETURNS TABLE (
  item_name TEXT,
  days_overdue INTEGER,
  confidence DECIMAL(3,2),
  last_purchased TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pp.item_name,
    EXTRACT(DAY FROM (NOW() - pp.next_predicted))::INTEGER as days_overdue,
    pp.confidence,
    pp.last_purchased
  FROM purchase_patterns pp
  WHERE pp.household_id = p_household_id
    AND pp.next_predicted <= NOW()
    AND pp.confidence >= 0.3
  ORDER BY pp.confidence DESC, (NOW() - pp.next_predicted) DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
