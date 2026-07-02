const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });
const sql = postgres(process.env.POSTGRES_URL || process.env.DATABASE_URL);
async function run() {
  const users = await sql`SELECT username, id FROM imported_users WHERE username ILIKE '%chris%'`;
  console.log('USERS:', users);
  const allUsers = await sql`SELECT username FROM imported_users`;
  console.log('ALL USERS:', allUsers.map(u => u.username));
  process.exit(0);
}
run();
