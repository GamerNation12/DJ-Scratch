const postgres = require("postgres");
const DB_URL = "postgresql://postgres.iuswdculretmygbseltt:GamerDoop7%21%26@aws-1-us-east-1.pooler.supabase.com:5432/postgres";
const sql = postgres(DB_URL);

async function main() {
  const userId = "gamernation12";
  
  const rows = await sql`
    SELECT user_id, lastfm_username, private_mode, data_source, discord_username, display_name, is_banned, ban_reason 
    FROM user_settings 
    WHERE REPLACE(REPLACE(discord_username, ' ', ''), '-', '') ILIKE REPLACE(REPLACE(${userId}, ' ', ''), '-', '') 
       OR REPLACE(REPLACE(lastfm_username, ' ', ''), '-', '') ILIKE REPLACE(REPLACE(${userId}, ' ', ''), '-', '') 
       OR REPLACE(REPLACE(display_name, ' ', ''), '-', '') ILIKE REPLACE(REPLACE(${userId}, ' ', ''), '-', '')
  `;
  
  console.log("Rows found for gamernation12:");
  for (const row of rows) {
    console.log(row);
  }
  process.exit(0);
}

main();
