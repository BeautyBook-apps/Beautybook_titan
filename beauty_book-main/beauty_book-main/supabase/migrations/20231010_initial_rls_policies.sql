-- Enable RLS on core tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE produits ENABLE ROW LEVEL SECURITY;
ALTER TABLE commandes ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone."
  ON profiles FOR SELECT
  USING ( true );

CREATE POLICY "Users can insert their own profile."
  ON profiles FOR INSERT
  WITH CHECK ( auth.uid() = id );

CREATE POLICY "Users can update own profile."
  ON profiles FOR UPDATE
  USING ( auth.uid() = id );

CREATE POLICY "Admins can update any profile."
  ON profiles FOR UPDATE
  USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

-- Produits Policies
CREATE POLICY "Products are viewable by everyone."
  ON produits FOR SELECT
  USING ( true );

CREATE POLICY "Vendeurs can insert their own products."
  ON produits FOR INSERT
  WITH CHECK ( 
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('vendeur', 'admin') 
    -- Assuming created_by or similar field links to the seller's email/id
  );

CREATE POLICY "Vendeurs can update their own products."
  ON produits FOR UPDATE
  USING ( 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' OR
    (SELECT email FROM profiles WHERE id = auth.uid()) = created_by
  );

-- Commandes Policies
CREATE POLICY "Users can view their own orders."
  ON commandes FOR SELECT
  USING ( auth.uid() = user_id OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'vendeur') );

CREATE POLICY "Users can insert their own orders."
  ON commandes FOR INSERT
  WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Admins and Vendeurs can update orders."
  ON commandes FOR UPDATE
  USING ( (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'vendeur') );

-- Trigger for creating a profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
