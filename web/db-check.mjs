import postgres from 'postgres';
import { loadEnvConfig } from '@next/env';
import { fileURLToPath } from 'url';
import path from 'path';

const projectDir = process.cwd();
loadEnvConfig(projectDir);

const sql = postgres(process.env.POSTGRES_URL || process.env.DATABASE_URL);

async function run() {
  const users = await sql`SELECT username, id FROM imported_users WHERE username ILIKE '%chris%'`;
  console.log('USERS LIKE CHRIS:', users);
  
  const allUsers = await sql`SELECT username, id FROM imported_users LIMIT 50`;
  console.log('ALL USERS SAMPLE:', allUsers);
  process.exit(0);
}
run();
