import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

// Single shared client per serverless instance. Creating a client per
// request exhausts Postgres (EMAXCONN: every pool holds its connections
// open and warm instances never release them). Small pool + quick idle
// release keeps total connections bounded no matter how many routes run.
function createClient() {
  return postgres(DB_URL!, {
    max: 2,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

const globalForPostgres = globalThis as unknown as {
  sql: ReturnType<typeof createClient> | undefined;
};

export const sql = globalForPostgres.sql ?? (globalForPostgres.sql = createClient());

export function getDb() {
  return sql;
}
