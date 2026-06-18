import { neon } from "@neondatabase/serverless";
import PublicProfileClient from "./PublicProfileClient";

export async function generateStaticParams() {
  try {
    const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL!);
    const rows = await sql`SELECT user_id FROM user_settings WHERE lastfm_username IS NOT NULL OR data_source = 'spotify'`;
    return rows.map((row) => ({ id: row.user_id }));
  } catch (e) {
    console.error("Failed to fetch users for static generation", e);
    return [];
  }
}

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicProfileClient id={id} />;
}
