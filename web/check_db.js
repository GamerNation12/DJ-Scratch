require('dotenv').config({ path: '.env.local' });
const { Pool } = require('@neondatabase/serverless');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    const tables = res.rows.map(r => r.table_name);
    console.log('Tables:', tables);

    for (const table of tables) {
      const colRes = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='${table}'`);
      console.log(`Table ${table}:`, colRes.rows.map(r => r.column_name));
    }
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
