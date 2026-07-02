import postgres from 'postgres';
import { loadEnvConfig } from '@next/env';
import { fileURLToPath } from 'url';
import path from 'path';

const projectDir = process.cwd();
loadEnvConfig(projectDir);

const sql = postgres(process.env.POSTGRES_URL || process.env.DATABASE_URL);

async function check() {
  const users = await sql`SELECT * FROM imported_users`;
  console.log("IMPORTED USERS:", users);
  
  const friends = await sql`SELECT * FROM friends`;
  console.log("FRIENDS:", friends);
  
  process.exit(0);
}
check();
