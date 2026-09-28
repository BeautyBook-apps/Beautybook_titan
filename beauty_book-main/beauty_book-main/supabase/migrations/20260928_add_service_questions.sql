-- Questions personnalisées du parcours de réservation, définies par le pro
-- à la création du service (étape 4). Format : [{id, question, type, options}]
-- type = 'qcm' (options) | 'ouverte' (réponse libre).
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS questions jsonb DEFAULT '[]'::jsonb;
