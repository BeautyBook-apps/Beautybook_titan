-- ─────────────────────────────────────────────────────────────────────────────
-- Persistance des conversations Maria AI
-- La page Maria sauvegarde désormais la conversation après chaque échange
-- (table MariaConversation) : elle survit au rechargement et au changement
-- d'appareil. Script idempotent : sûr à exécuter même si la table existe déjà.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public."MariaConversation" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mariaconv_email_updated
  ON public."MariaConversation" (user_email, updated_at DESC);

ALTER TABLE public."MariaConversation" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "maria_conv_owner_all" ON public."MariaConversation";
CREATE POLICY "maria_conv_owner_all"
  ON public."MariaConversation" FOR ALL
  TO authenticated
  USING (user_email = (select auth.email()))
  WITH CHECK (user_email = (select auth.email()));
