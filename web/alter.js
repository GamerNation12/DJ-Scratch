const postgres = require('postgres');
const dbUrl = "postgresql://postgres.iuswdculretmygbseltt:GamerDoop7%21%26@aws-1-us-east-1.pooler.supabase.com:5432/postgres";
const sql = postgres(dbUrl);

async function main() {
  try {
    await sql`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS display_name TEXT;`;
    await sql`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;`;
    await sql`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS ban_reason TEXT;`;
    await sql`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS ban_expires_at TIMESTAMP;`;
    console.log("Successfully added all columns to user_settings.");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

main();
