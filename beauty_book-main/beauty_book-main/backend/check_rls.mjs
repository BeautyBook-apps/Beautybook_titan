import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || '',
  ssl: { rejectUnauthorized: false }
});
try {
  // Check RLS status and policies for pro-related tables
  const tables = ['ProfilPro','Service','Reservation','MembreEquipe','Avis','Style','VisiteVirtuelle','CatalogueOption','Annonce','DemandefFranchise','DemandeProV2','LiveSession','LiveMessage','CallSignal','Produit','Reel','Publication'];
  
  const rls = await pool.query(`
    SELECT c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls
    FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relname IN (${tables.map(t => "'" + t + "'").join(',')})
    ORDER BY c.relname
  `);
  
  console.log('=== RLS STATUS ===');
  for (const row of rls.rows) {
    console.log(row.table_name + ': RLS=' + row.rls_enabled + ' Force=' + row.force_rls);
  }

  const policies = await pool.query(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies WHERE schemaname = 'public' AND tablename IN (${tables.map(t => "'" + t + "'").join(',')})
    ORDER BY tablename, policyname
  `);
  
  console.log('\n=== POLICIES ===');
  let lastTable = '';
  for (const row of policies.rows) {
    if (row.tablename !== lastTable) { console.log('\n' + row.tablename + ':'); lastTable = row.tablename; }
    console.log('  ' + row.policyname + ' [' + row.cmd + '] roles=' + (row.roles || 'public'));
  }
  
  // Check if there are tables WITHOUT RLS
  const noRls = rls.rows.filter(r => !r.rls_enabled);
  if (noRls.length > 0) {
    console.log('\n=== TABLES WITHOUT RLS ===');
    for (const row of noRls) console.log(row.table_name);
  }
  
} catch(e) { console.error(e.message); }
await pool.end();
