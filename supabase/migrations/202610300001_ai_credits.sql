BEGIN;

CREATE TABLE IF NOT EXISTS public.bb_ai_credit_wallets(
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK(balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bb_ai_credit_purchases(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_key text NOT NULL UNIQUE,
  stripe_session_id text UNIQUE,
  checkout_url text,
  stripe_payment_intent_id text,
  package_id text NOT NULL,
  credits integer NOT NULL CHECK(credits > 0),
  amount_cents integer NOT NULL CHECK(amount_cents > 0),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','expired','refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bb_ai_credit_ledger(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta integer NOT NULL CHECK(delta <> 0),
  balance_after integer NOT NULL CHECK(balance_after >= 0),
  reason text NOT NULL CHECK(reason IN ('purchase','generation','generation_refund','admin_adjustment')),
  image_job_id uuid REFERENCES public.bb_image_jobs(id) ON DELETE SET NULL,
  stripe_session_id text UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bb_image_jobs
  ADD COLUMN IF NOT EXISTS billing_source text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS credit_cost integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_refunded_at timestamptz;

ALTER TABLE public.bb_image_jobs
  DROP CONSTRAINT IF EXISTS bb_image_jobs_billing_source_check;
ALTER TABLE public.bb_image_jobs
  ADD CONSTRAINT bb_image_jobs_billing_source_check CHECK(billing_source IN ('free','credits'));

CREATE INDEX IF NOT EXISTS bb_ai_credit_ledger_user_created
  ON public.bb_ai_credit_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bb_ai_credit_purchases_user_created
  ON public.bb_ai_credit_purchases(user_id, created_at DESC);

ALTER TABLE public.bb_ai_credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_ai_credit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_ai_credit_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bb_ai_credit_wallets, public.bb_ai_credit_purchases, public.bb_ai_credit_ledger FROM anon, authenticated;
GRANT ALL ON public.bb_ai_credit_wallets, public.bb_ai_credit_purchases, public.bb_ai_credit_ledger TO service_role;

COMMIT;
