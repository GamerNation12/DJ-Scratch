const postgres = require('postgres');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const sql = postgres(process.env.POSTGRES_URL || process.env.DATABASE_URL);

async function check() {
  const users = await sql`SELECT * FROM imported_users`;
  console.log("IMPORTED USERS:", users);
  
  process.exit(0);
}
check();
