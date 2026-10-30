import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
export const users={
 client:{id:'00000000-0000-0000-0000-000000000001',email:'client@test.invalid'},
 professional:{id:'00000000-0000-0000-0000-000000000002',email:'professional@test.invalid'},
 other:{id:'00000000-0000-0000-0000-000000000003',email:'other@test.invalid'},
 admin:{id:'00000000-0000-0000-0000-000000000004',email:'admin@test.invalid'},
};
export async function databaseFixture({schemaMode=process.env.BEAUTYBOOK_TEST_SCHEMA||'local'}={}){
 const pg=new PGlite();
 try{
  await pg.exec(`
   CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
   CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
   CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_user::text $$;
   GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
   CREATE SCHEMA storage;
   CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean DEFAULT false);
   CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets(id),name text NOT NULL);
   CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array(name,'/'))[1:greatest(array_length(string_to_array(name,'/'),1)-1,0)] $$;
   GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
   GRANT ALL ON ALL TABLES IN SCHEMA storage TO anon,authenticated,service_role;
   ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
   CREATE POLICY legacy_unrestricted ON storage.objects FOR ALL USING(true) WITH CHECK(true);
  `);
  const schema=await fs.readFile(new URL('../../supabase/schema.sql',import.meta.url),'utf8');
  if(schemaMode==='remote'){
   const snapshot=JSON.parse(await fs.readFile(new URL('../../../../docs/audit/remote-schema.json',import.meta.url),'utf8'));
   const types=new Set(['uuid','text','text[]','integer','numeric','double precision','boolean','jsonb','timestamp with time zone']);
   for(const [table,columns] of Object.entries(snapshot.columnTypes)){
    if(!/^\w+$/.test(table))throw new Error('Invalid snapshot table');
    const fields=Object.entries(columns).map(([name,c])=>{
     if(!/^\w+$/.test(name)||!types.has(c.format))throw new Error('Invalid snapshot column');
     let suffix=name==='id'?' PRIMARY KEY DEFAULT gen_random_uuid()':name==='created_at'||name==='updated_at'?' DEFAULT now()':c.format==='text[]'?" DEFAULT '{}'":c.format==='boolean'?' DEFAULT false':name==='seats_count'?' DEFAULT 1':name==='status'?" DEFAULT 'en_attente'":'';
     return '"'+name+'" '+c.format+suffix;
    });
    await pg.exec('CREATE TABLE public."'+table+'"('+fields.join(',')+')');
   }
  }else for(const match of schema.matchAll(/CREATE TABLE IF NOT EXISTS public\.[\s\S]*?\n\);/g))await pg.exec(match[0].replaceAll('uuid_generate_v4()','gen_random_uuid()'));
  await pg.exec(`
   CREATE TABLE IF NOT EXISTS public."DemandeProV2"(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_email text,salon_name text,bio text,address text,city text,phone text,specialites text[],status text DEFAULT 'en_attente',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
   GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated,service_role;
  `);
  for(const user of Object.values(users)){
   await pg.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[user.id,user.email]);
   await pg.query("INSERT INTO public.profiles(id,email,role) VALUES($1,$2,'user')",[user.id,user.email]);
  }
  const dir=new URL('../../../../supabase/migrations/',import.meta.url);
  for(const name of ['202609170000_schema_alignment.sql','202609170001_secure_backend.sql','202609180001_payments.sql','202609180002_data_ownership.sql','202609180003_outbox.sql','202609180004_commerce.sql','202609190001_receptionist.sql','202609190002_reviews_media.sql','202609190003_image_jobs.sql','202610100002_style_engagement_metrics.sql','202610300001_ai_credits.sql','202610300002_ai_credit_admin.sql','202610300003_reel_analytics.sql','202610300004_professional_profile_views.sql','202610300005_style_engagement_counters.sql'])await pg.exec(await fs.readFile(new URL(name,dir),'utf8'));
  return {
   pg,query:(sql,p)=>pg.query(sql,p),transaction:work=>pg.transaction(tx=>work(tx)),close:()=>pg.close(),
   async as(user){await pg.exec('RESET ROLE');await pg.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user.id,JSON.stringify({email:user.email})]);await pg.exec('SET ROLE authenticated');},
   async privileged(){await pg.exec('RESET ROLE');},
  };
 }catch(error){await pg.close();throw error;}
}
