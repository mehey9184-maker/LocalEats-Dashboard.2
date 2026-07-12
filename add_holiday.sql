ALTER TABLE shops ADD COLUMN IF NOT EXISTS holiday_start_date TIMESTAMPTZ;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS holiday_end_date TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION check_shop_holiday_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.holiday_start_date IS NOT NULL AND NEW.holiday_end_date IS NOT NULL THEN
    IF CURRENT_TIMESTAMP >= NEW.holiday_start_date AND CURRENT_TIMESTAMP <= NEW.holiday_end_date THEN
      NEW.is_active = false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_shop_holiday ON shops;
CREATE TRIGGER trg_check_shop_holiday
BEFORE INSERT OR UPDATE OF holiday_start_date, holiday_end_date, is_active ON shops
FOR EACH ROW
EXECUTE FUNCTION check_shop_holiday_status();

