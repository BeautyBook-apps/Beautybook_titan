-- Champs écrits par le parcours de réservation (migration compatible avec les
-- bases existantes qui n'ont pas encore reçu tous les champs du schéma courant).
ALTER TABLE IF EXISTS public."Reservation"
  ADD COLUMN IF NOT EXISTS night_surcharge NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seat_number TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS booking_code TEXT,
  ADD COLUMN IF NOT EXISTS qr_code_url TEXT,
  ADD COLUMN IF NOT EXISTS custom_answers JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_answer_labels JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'non_paye',
  ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'surplace',
  ADD COLUMN IF NOT EXISTS acompte_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS addons JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS transport_fee NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport_distance_km NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_location TEXT DEFAULT 'salon',
  ADD COLUMN IF NOT EXISTS client_address TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_postal_code TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_city TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS client_longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS seats_total INTEGER,
  ADD COLUMN IF NOT EXISTS created_by_id UUID;

NOTIFY pgrst, 'reload schema';
