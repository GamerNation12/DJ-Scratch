import postgres from "postgres";

export function getDb() {
  return postgres(process.env.DATABASE_URL!);
}
