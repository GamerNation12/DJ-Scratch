const fs = require('fs');
let env = '';
try {
  env = fs.readFileSync('web/.env.local', 'utf16le');
} catch(e) {
  env = fs.readFileSync('web/.env.local', 'utf8');
}
const dbUrlMatch = env.match(/DATABASE_URL="?([^"\r\n]+)/);
if (!dbUrlMatch) { console.error("No db url"); process.exit(1); }
const dbUrl = dbUrlMatch[1];
const postgres = require('postgres');
const sql = postgres(dbUrl);
sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'direct_messages'`.then(res => { console.log(res); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
