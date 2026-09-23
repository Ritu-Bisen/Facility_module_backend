const db = require('../src/config/db');
const oracledb = require('oracledb');

async function run() {
  try {
    await db.initialize();

    console.log("=== TABLES WITH AI OR CAT OR TYPE ===");
    const res = await db.execute(
      "SELECT table_name FROM user_tables WHERE table_name LIKE '%AI%' OR table_name LIKE '%CAT%' OR table_name LIKE '%TYPE%' ORDER BY table_name",
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    console.log(res.rows.map(r => r.TABLE_NAME));

  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
