-- FILE ONLY: never run automatically against production. Existing brand values are preserved.
BEGIN;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.site_settings'::regclass AND conname='site_deposit_percentage_bounds') THEN
 ALTER TABLE public.site_settings ADD CONSTRAINT site_deposit_percentage_bounds CHECK(deposit_percentage BETWEEN 0 AND 100) NOT VALID;
END IF; END $$;
-- NOT VALID preserves historical rows while validating every new/changed row.
-- Existing booking.deposit_amount is a snapshot; never update existing bookings here.
COMMIT;
