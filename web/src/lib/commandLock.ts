import postgres from "postgres";

/**
 * Mirrors the Discord bot's `disabled_commands` lock (see bot `is_command_disabled`).
 * Returns the lock reason when the command is disabled, otherwise null.
 * Fail-open (null) on any error, e.g. table not existing yet — same as the bot.
 */
export async function getDisabledCommandReason(command: string): Promise<string | null> {
  let sql: ReturnType<typeof postgres> | null = null;
  try {
    sql = postgres(process.env.DATABASE_URL || "");
    const rows = await sql`SELECT reason FROM disabled_commands WHERE command_name = ${command}`;
    if (rows.length > 0) {
      const r = (rows[0] as { reason?: unknown }).reason;
      return typeof r === "string" && r ? r : "This command is currently disabled.";
    }
    return null;
  } catch {
    return null;
  } finally {
    try {
      await sql?.end();
    } catch {
      /* ignore */
    }
  }
}
