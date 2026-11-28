import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
try {
  const r = await pool.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position");
  const tables = {};
  for (const row of r.rows) {
    if (!tables[row.table_name]) tables[row.table_name] = [];
    tables[row.table_name].push(row.column_name + ' (' + row.data_type + ')');
  }
  for (const [t, cols] of Object.entries(tables).sort()) {
    console.log('\n=== ' + t + ' (' + cols.length + ' cols) ===');
    console.log(cols.join(', '));
  }
} catch(e) { console.error(e.message); }
await pool.end();
