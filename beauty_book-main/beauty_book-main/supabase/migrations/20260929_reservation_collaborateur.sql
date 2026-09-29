-- Assigne un collaborateur à chaque réservation.
-- Rend le « CA par collaborateur » de la page AI Scaling Business 100% réel :
-- sans cette colonne, aucun RDV ne peut être attribué à un membre de l'équipe.
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS collaborateur TEXT;

-- Index léger pour le classement par collaborateur.
CREATE INDEX IF NOT EXISTS idx_reservation_collaborateur ON "Reservation" (pro_email, collaborateur);
