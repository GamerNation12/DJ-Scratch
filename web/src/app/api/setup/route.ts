import postgres from "postgres";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const sql = postgres(process.env.DATABASE_URL!);

    await sql`
      CREATE TABLE IF NOT EXISTS imported_users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS listens (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES imported_users(id),
        artist_name VARCHAR(255) NOT NULL,
        track_name VARCHAR(255) NOT NULL,
        album_name VARCHAR(255),
        played_at TIMESTAMP WITH TIME ZONE NOT NULL,
        UNIQUE (user_id, artist_name, track_name, played_at)
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_listens_user_id ON listens(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_listens_artist_name ON listens(artist_name)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_listens_played_at ON listens(played_at DESC)`;

    await sql`
      CREATE TABLE IF NOT EXISTS friends (
        user_id VARCHAR(255) REFERENCES imported_users(id) ON DELETE CASCADE,
        friend_id VARCHAR(255) REFERENCES imported_users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, friend_id)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id SERIAL PRIMARY KEY,
        sender_id VARCHAR(255) REFERENCES imported_users(id) ON DELETE CASCADE,
        receiver_id VARCHAR(255) REFERENCES imported_users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP WITH TIME ZONE
      )
    `;

    // Add read_at if it doesn't exist for existing tables
    try {
      await sql`ALTER TABLE direct_messages ADD COLUMN read_at TIMESTAMP WITH TIME ZONE`;
    } catch(e) {
      // Column might already exist, ignore
    }

    // Add reactions if it doesn't exist
    try {
      await sql`ALTER TABLE direct_messages ADD COLUMN reactions JSONB DEFAULT '[]'::jsonb`;
    } catch(e) {
      // Column might already exist, ignore
    }

    await sql`CREATE INDEX IF NOT EXISTS idx_dm_sender ON direct_messages(sender_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_dm_receiver ON direct_messages(receiver_id)`;

    return NextResponse.json({ message: "Database setup successful!" }, { status: 200 });
  } catch (error) {
    console.error("Failed to setup database:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
