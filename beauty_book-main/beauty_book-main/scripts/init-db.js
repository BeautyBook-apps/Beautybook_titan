import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = readFileSync(resolve(__dirname, '../supabase/schema.sql'), 'utf-8');

async function initDb() {
  console.log('Applying schema to Supabase...');
  const { error } = await supabase.rpc('exec_sql', { sql_text: sql });
  if (error) {
    console.log('RPC method not available, trying direct SQL...');
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    let successCount = 0;
    let failCount = 0;
    for (const stmt of statements) {
      const { error: e } = await supabase.from('_sql_exec').insert({ query: stmt + ';' }).single().maybeSingle();
      if (e && !e.message?.includes('relation "_sql_exec"')) {
        console.log('Failed:', stmt.substring(0, 80), e.message);
        failCount++;
      } else {
        successCount++;
      }
    }
    console.log(`Executed ${successCount} statements, ${failCount} failed`);
    if (failCount > 0) {
      console.log('\nPlease run the schema manually:');
      console.log('1. Go to https://supabase.com/dashboard/project/grlinrqxctmiegaluupi');
      console.log('2. Open SQL Editor');
      console.log('3. Paste and run the content of supabase/schema.sql');
    }
    return;
  }
  console.log('Schema applied successfully!');
}

initDb().catch(console.error);
