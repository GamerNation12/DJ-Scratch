import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

// Prevent creating multiple connections during hot-reloads in development
// and across multiple lambda invocations.
const globalForPostgres = globalThis as unknown as {
  sql: postgres.Sql | undefined;
};

export const sql = globalForPostgres.sql || postgres(DB_URL!, { max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForPostgres.sql = sql;
}

export function getDb() {
  return sql;
}
