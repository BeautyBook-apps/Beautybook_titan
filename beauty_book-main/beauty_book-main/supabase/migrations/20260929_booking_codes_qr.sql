-- ─── Codes de réservation + QR code ─────────────────────────────────────────
-- booking_code : matricule unique saisissable (ex « BB-7K2Q9P ») — permet au
--   client sans application (appel via l'agent vocal IA) de retrouver son
--   récapitulatif via « Ajouter un ID de réservation ».
-- qr_code_url  : URL publique du QR code (récapitulatif + codes), généré à
--   la confirmation du RDV et inclus dans l'email de confirmation.

ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS booking_code text;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS qr_code_url text;

-- Unicité du matricule (les doublons éventuels sont régénérés ci-dessous)
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT id FROM "Reservation"
    WHERE booking_code IS NULL OR booking_code = ''
  ) LOOP
    UPDATE "Reservation"
    SET booking_code = 'BB-' || upper(substr(md5(random()::text || r.id::text || clock_timestamp()::text), 1, 6))
    WHERE id = r.id;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reservation_booking_code_unique'
  ) THEN
    ALTER TABLE "Reservation" ADD CONSTRAINT reservation_booking_code_unique UNIQUE (booking_code);
  END IF;
END $$;

-- Matricule automatique pour les futures insertions (ex : serveur vocal)
ALTER TABLE "Reservation"
  ALTER COLUMN booking_code
  SET DEFAULT ('BB-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)));

-- Code client à 4 chiffres : valeur par défaut aussi (le serveur vocal ne le renseigne pas)
DO $$
BEGIN
  UPDATE "Reservation"
  SET crg_code = lpad(floor(random() * 9000 + 1000)::int::text, 4, '0')
  WHERE crg_code IS NULL OR crg_code = '';
  ALTER TABLE "Reservation"
    ALTER COLUMN crg_code
    SET DEFAULT (lpad(floor(random() * 9000 + 1000)::int::text, 4, '0'));
EXCEPTION WHEN OTHERS THEN
  -- colonne crg_code absente ? on ignore (anciennes bases)
  NULL;
END $$;

-- ─── RPC : retrouver une réservation par son matricule ──────────────────────
-- SECURITY DEFINER : le client connaît le code secret, pas besoin d'être le
-- propriétaire en base. Ne retourne que les champs du récapitulatif.
CREATE OR REPLACE FUNCTION get_reservation_by_code(p_code text)
RETURNS TABLE (
  id text, booking_code text, crg_code text, qr_code_url text,
  service_name text, date text, time_slot text, duration_min text,
  total_price text, service_price text,
  salon_name text, pro_name text, salon_address text,
  client_name text, status text, payment_status text
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_code text := upper(trim(p_code));
BEGIN
  RETURN QUERY
  SELECT r.id::text, r.booking_code, r.crg_code, r.qr_code_url,
         r.service_name, r.date::text, r.time_slot, r.duration_min::text,
         r.total_price::text, r.service_price::text,
         r.salon_name, r.pro_name, r.salon_address,
         r.client_name, r.status, r.payment_status
  FROM "Reservation" r
  WHERE upper(r.booking_code) = v_code
     OR r.id::text = trim(p_code)
  LIMIT 1;
END $$;

-- ─── Bucket public pour les QR codes ────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('qr-codes', 'qr-codes', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'qr-codes public read') THEN
    CREATE POLICY "qr-codes public read" ON storage.objects
      FOR SELECT USING (bucket_id = 'qr-codes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'qr-codes authenticated write') THEN
    CREATE POLICY "qr-codes authenticated write" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'qr-codes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'qr-codes authenticated update') THEN
    CREATE POLICY "qr-codes authenticated update" ON storage.objects
      FOR UPDATE USING (bucket_id = 'qr-codes');
  END IF;
END $$;
