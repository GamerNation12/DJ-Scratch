const postgres = require("postgres");
const dotenv = require("dotenv");
dotenv.config({ path: "c:/Users/minec/Documents/GitHub/The-Goats-Dj/.env" });

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const sql = postgres(DB_URL);

async function run() {
  const uId = "759433582107426816";
  try {
        const [playcountRes, topArtistsRes, topTracksRes, recentTracksRes] = await Promise.all([
          sql`SELECT COUNT(*) as count FROM listens WHERE user_id = ${uId}`,
          sql`SELECT t.artist_name, COUNT(*) as playcount FROM listens l JOIN tracks t ON l.track_id = t.id WHERE l.user_id = ${uId} GROUP BY t.artist_name ORDER BY playcount DESC LIMIT 50`,
          sql`SELECT t.track_name, t.artist_name, COUNT(*) as playcount FROM listens l JOIN tracks t ON l.track_id = t.id WHERE l.user_id = ${uId} GROUP BY t.track_name, t.artist_name ORDER BY playcount DESC LIMIT 50`,
          sql`SELECT t.track_name, t.artist_name, l.played_at FROM listens l JOIN tracks t ON l.track_id = t.id WHERE l.user_id = ${uId} ORDER BY l.played_at DESC LIMIT 50`
        ]);
        console.log("Success!");
        console.log("Playcount:", playcountRes[0]?.count);
  } catch (e) {
        console.error("Imported plays fetch error:", e);
  }
  process.exit(0);
}
run();
