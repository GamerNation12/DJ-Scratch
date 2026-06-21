const postgres = require('postgres');
require('dotenv').config();

async function check() {
  const DB_URL = process.env.DATABASE_URL;
  try {
    const sql = postgres(DB_URL);
    const result = await sql`SELECT 1 as connected`;
    console.log("Success:", result);
    process.exit(0);
  } catch(e) {
    console.error("Error connecting:", e);
    process.exit(1);
  }
}
check();
