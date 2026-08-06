const postgres = require('postgres');
require('dotenv').config({path: '../.env'});
const sql = postgres(process.env.DATABASE_URL);

async function run() {
  try {
    const res = await sql`
      INSERT INTO disabled_commands (command_name, reason, disabled_by) 
      VALUES ('import', 'Testing', '12345')
      ON CONFLICT (command_name) DO UPDATE SET 
      reason = EXCLUDED.reason, 
      disabled_at = CURRENT_TIMESTAMP, 
      disabled_by = EXCLUDED.disabled_by
    `;
    console.log('Success:', res);
  } catch (e) {
    console.error('Error:', e);
  }
  process.exit();
}
run();
