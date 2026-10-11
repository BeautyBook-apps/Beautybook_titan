-- Conserve les réponses du questionnaire et les intitulés affichés au moment de la réservation.
ALTER TABLE IF EXISTS public."Reservation"
  ADD COLUMN IF NOT EXISTS custom_answers JSONB DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS public."Reservation"
  ADD COLUMN IF NOT EXISTS custom_answer_labels JSONB DEFAULT '{}'::jsonb;
