const db = require('../src/config/db');
const oracledb = require('oracledb');
async function run() {
  try {
    await db.initialize();
    const result = await db.execute("SELECT column_name FROM user_tab_columns WHERE table_name = 'MASRACKS'");
    console.log(result.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
