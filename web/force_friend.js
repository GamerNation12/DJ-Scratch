const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

const sql = postgres(process.env.POSTGRES_URL || process.env.DATABASE_URL);

async function run() {
  const user1 = await sql`SELECT id FROM imported_users WHERE lower(username) = 'gamernation12' LIMIT 1`;
  const user2 = await sql`SELECT id FROM imported_users WHERE lower(username) = 'chris.007' LIMIT 1`;
  
  if (user1.length > 0 && user2.length > 0) {
    const id1 = user1[0].id;
    const id2 = user2[0].id;
    
    // Make them friends both ways
    await sql`INSERT INTO friends (user_id, friend_id, status) VALUES (${id1}, ${id2}, 'accepted') ON CONFLICT (user_id, friend_id) DO UPDATE SET status='accepted'`;
    await sql`INSERT INTO friends (user_id, friend_id, status) VALUES (${id2}, ${id1}, 'accepted') ON CONFLICT (user_id, friend_id) DO UPDATE SET status='accepted'`;
    console.log("Friendship established!");
  } else {
    console.log("Could not find one or both users in imported_users table.");
    console.log("User 1 found:", user1.length > 0);
    console.log("User 2 found:", user2.length > 0);
  }
  process.exit(0);
}
run();
