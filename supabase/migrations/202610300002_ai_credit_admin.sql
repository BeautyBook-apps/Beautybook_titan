CREATE TABLE IF NOT EXISTS public.bb_ai_credit_settings(
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  free_daily_limit integer NOT NULL DEFAULT 5 CHECK (free_daily_limit > 0 AND free_daily_limit <= 100),
  provider_cost_cents integer NOT NULL DEFAULT 20 CHECK (provider_cost_cents >= 0 AND provider_cost_cents <= 100000),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bb_ai_credit_packages(
  id text PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9_-]{1,40}$'),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  credits integer NOT NULL CHECK (credits > 0 AND credits <= 100000),
  amount_cents integer NOT NULL CHECK (amount_cents >= 50 AND amount_cents <= 1000000),
  highlight boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.bb_ai_credit_settings(id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.bb_ai_credit_packages(id,name,credits,amount_cents,highlight,active,display_order)
VALUES
  ('starter','Pack Découverte',10,499,false,true,1),
  ('studio','Pack Studio',30,999,true,true,2),
  ('creator','Pack Créateur',100,2499,false,true,3)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.bb_ai_credit_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_ai_credit_packages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bb_ai_credit_settings, public.bb_ai_credit_packages FROM anon, authenticated;
GRANT ALL ON public.bb_ai_credit_settings, public.bb_ai_credit_packages TO service_role;
