const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

async function run() {
  // Try SQL endpoint
  const sql = `
    CREATE TABLE IF NOT EXISTS public.profiles (
      id UUID PRIMARY KEY,
      email TEXT,
      full_name TEXT,
      avatar_url TEXT,
      cover_url TEXT,
      role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'vendeur')),
      maria_name TEXT,
      maria_memory JSONB DEFAULT '{}'::jsonb,
      nom TEXT,
      prenom TEXT,
      phone TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "profiles: lecture publique" ON public.profiles FOR SELECT USING (true);
    CREATE POLICY IF NOT EXISTS "profiles: modif soi-meme" ON public.profiles FOR UPDATE USING (auth.uid() = id);
    CREATE POLICY IF NOT EXISTS "profiles: insertion auto" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
    BEGIN
      INSERT INTO public.profiles (id, email, full_name, avatar_url)
      VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url');
      RETURN NEW;
    END;
    $$;
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  `;

  const endpoints = [
    { url: `${SUPABASE_URL}/sql`, label: '/sql' },
    { url: `${SUPABASE_URL}/rest/v1/rpc/exec_sql`, label: '/rpc/exec_sql' },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ query: sql }),
      });
      const text = await res.text();
      console.log(`${ep.label}: ${res.status} ${text.substring(0, 200)}`);
    } catch (e) {
      console.log(`${ep.label}: Failed - ${e.message}`);
    }
  }
}

run();
