require('dotenv').config({path: 'web/.env.local'}); 
const postgres = require('postgres'); 
const sql = postgres(process.env.DATABASE_URL); 
sql`SELECT user_id, discord_username FROM user_settings`.then(console.log).then(() => process.exit(0));
