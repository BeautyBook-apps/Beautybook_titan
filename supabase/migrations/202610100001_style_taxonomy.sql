-- Shared taxonomy for the main app and the admin panel.
-- Apply this migration to the Supabase project before using the taxonomy API.

CREATE TABLE IF NOT EXISTS public."StyleCategory" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'Palette',
  color TEXT NOT NULL DEFAULT '#E8732A',
  is_active BOOLEAN NOT NULL DEFAULT true,
  styles_count INTEGER NOT NULL DEFAULT 0,
  subcategories_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."StyleSubCategory" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public."StyleCategory"(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  styles_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slug, category_id)
);

ALTER TABLE public."Style"
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public."StyleCategory"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES public."StyleSubCategory"(id) ON DELETE SET NULL;

ALTER TABLE public."StyleCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."StyleSubCategory" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "StyleCategory public active read" ON public."StyleCategory";
CREATE POLICY "StyleCategory public active read"
  ON public."StyleCategory" FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "StyleSubCategory public active read" ON public."StyleSubCategory";
CREATE POLICY "StyleSubCategory public active read"
  ON public."StyleSubCategory" FOR SELECT
  USING (is_active = true);

-- Admin writes are performed by the backend with the Supabase service role.
GRANT SELECT ON public."StyleCategory", public."StyleSubCategory" TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."StyleCategory", public."StyleSubCategory" TO service_role;

DO $$
DECLARE
  category_row RECORD;
  subcategory_name TEXT;
  current_category_id UUID;
BEGIN
  FOR category_row IN
    SELECT * FROM jsonb_to_recordset($taxonomy$
      [
        {"slug":"coiffure","name":"Coiffure","description":"Coupes, coiffage et techniques capillaires","icon":"Scissors","color":"#E8732A","subs":["Coupe Femme","Coupe Homme","Coupe Enfant","Brushing","Coloration","Décoloration","Lissage","Permanente","Chignon","Coiffure de mariage"]},
        {"slug":"perruque","name":"Perruque","description":"Perruques, lace wigs et poses","icon":"Sparkles","color":"#7C3AED","subs":["Lace Wig","Closure","Frontale","Perruque naturelle","Perruque synthétique","Pose de perruque","Entretien de perruque"]},
        {"slug":"tresses","name":"Tresses","description":"Tresses protectrices et coiffures afro","icon":"Waves","color":"#F43F5E","subs":["Box Braids","Knotless Braids","Cornrows","Fulani Braids","Vanilles","Twist","Passion Twist","Sisterlocks"]},
        {"slug":"extensions","name":"Extensions","description":"Extensions, tissages et poses","icon":"Sparkles","color":"#8B5CF6","subs":["Clip-in","Tape-in","Kératine","Tissage ouvert","Tissage fermé","Pose d'extensions","Retrait d'extensions"]},
        {"slug":"maquillage","name":"Maquillage","description":"Maquillage du visage, des yeux et des lèvres","icon":"Palette","color":"#D946EF","subs":["Naturel","Mariage","Glamour","Soirée","Artistique","Professionnel","Maquillage permanent","Microblading","Faux cils"]},
        {"slug":"ongles","name":"Ongles","description":"Manucure, gel, résine et nail art","icon":"Gem","color":"#EC4899","subs":["Gel","Résine","Acrylique","Semi-permanent","Nail Art","French","Baby Boomer","Capsules","Chrome"]},
        {"slug":"pedicure","name":"Pédicure","description":"Beauté et soin des pieds","icon":"Footprints","color":"#F59E0B","subs":["Pédicure classique","Pédicure spa","Semi-permanent","Gel pieds","French pieds","Soin des pieds"]},
        {"slug":"soins","name":"Soin","description":"Soins visage, corps et bien-être","icon":"Droplets","color":"#10B981","subs":["Soins visage","Soins corps","Hydratation","Anti-âge","Acné","Éclat","Détox","Gommage"]},
        {"slug":"barbe","name":"Barbe","description":"Taille, rasage et soins de la barbe","icon":"User","color":"#475569","subs":["Taille classique","Taille design","Dégradé","Rasage complet","Soin barbe","Coloration barbe"]},
        {"slug":"massage","name":"Massage","description":"Massages relaxants et spécialisés","icon":"Hand","color":"#F59E0B","subs":["Relaxant","Sportif","Thérapeutique","Drainant","Prénatal","Hot Stone","Aromathérapie"]},
        {"slug":"epilation","name":"Épilation","description":"Épilation visage et corps","icon":"Zap","color":"#818CF8","subs":["Cire chaude","Cire froide","Épilation laser","Sourcils","Visage","Corps","Maillot"]},
        {"slug":"cils-sourcils","name":"Cils & Sourcils","description":"Mise en beauté du regard","icon":"Eye","color":"#06B6D4","subs":["Extension cil à cil","Volume russe","Rehaussement de cils","Teinture cils","Brow Lift","Teinture sourcils"]},
        {"slug":"spa-bien-etre","name":"Spa & Bien-être","description":"Rituels spa et relaxation","icon":"Heart","color":"#14B8A6","subs":["Hammam","Sauna","Jacuzzi","Rituel corps","Rituel visage","Balnéothérapie","Détox"]},
        {"slug":"tatouage","name":"Tatouage","description":"Tatouage artistique et temporaire","icon":"PenTool","color":"#0EA5E9","subs":["Blackwork","Coloré","Aquarelle","Japonais","Géométrique","Cover-up","Temporaire"]},
        {"slug":"piercing","name":"Piercing","description":"Piercing des oreilles et du corps","icon":"Circle","color":"#8B5CF6","subs":["Lobe","Cartilage","Nez","Sourcil","Lèvre","Nombril","Corps"]}
      ]
    $taxonomy$::jsonb) AS taxonomy(slug TEXT, name TEXT, description TEXT, icon TEXT, color TEXT, subs JSONB)
  LOOP
    INSERT INTO public."StyleCategory" (name, slug, description, icon, color)
    VALUES (category_row.name, category_row.slug, category_row.description, category_row.icon, category_row.color)
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      icon = EXCLUDED.icon,
      color = EXCLUDED.color,
      is_active = true,
      updated_at = now();

    SELECT id INTO current_category_id
    FROM public."StyleCategory"
    WHERE slug = category_row.slug;

    FOR subcategory_name IN
      SELECT value FROM jsonb_array_elements_text(category_row.subs)
    LOOP
      INSERT INTO public."StyleSubCategory" (name, slug, category_id)
      VALUES (
        subcategory_name,
        trim(both '-' from regexp_replace(translate(lower(subcategory_name), 'éèêëàâäîïôöùûüç', 'eeeeaaaiioouuuc'), '[^a-z0-9]+', '-', 'g')),
        current_category_id
      )
      ON CONFLICT (slug, category_id) DO UPDATE SET
        name = EXCLUDED.name,
        is_active = true,
        updated_at = now();
    END LOOP;

    UPDATE public."StyleCategory"
    SET subcategories_count = (
      SELECT count(*) FROM public."StyleSubCategory" WHERE category_id = current_category_id
    ), updated_at = now()
    WHERE id = current_category_id;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
