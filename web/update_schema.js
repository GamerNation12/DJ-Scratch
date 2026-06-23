const postgres = require('postgres');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf16le');
const dbUrlMatch = envLocal.match(/DATABASE_URL="?([^"\r\n]+)"?/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1] : null;

if (!dbUrl) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

const sql = postgres(dbUrl);

async function main() {
  try {
    await sql`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS display_name TEXT;`;
    console.log("Successfully added display_name column to user_settings.");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

main();
