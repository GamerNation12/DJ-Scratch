const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });
const sql = postgres(process.env.POSTGRES_URL || process.env.DATABASE_URL);
async function run() {
  try {
    const targetUsername = 'chris.007';
    const uRow = await sql`SELECT id FROM imported_users WHERE LOWER(username) = LOWER(${targetUsername})`;
    console.log('uRow:', uRow);
    if (uRow.length === 0) {
      console.log('User not found');
      process.exit(0);
    }
    const finalTargetId = uRow[0].id;
    console.log('finalTargetId:', finalTargetId);
    
    const meRow = await sql`SELECT id FROM imported_users LIMIT 1`;
    const userId = meRow[0].id;
    
    console.log('Inserting for', userId, 'and', finalTargetId);
    await sql`INSERT INTO friends (user_id, friend_id, status) VALUES (${userId}, ${finalTargetId}, 'pending') ON CONFLICT (user_id, friend_id) DO NOTHING`;
    
    console.log('Success!');
  } catch(e) {
    console.error('ERROR:', e);
  }
  process.exit(0);
}
run();
