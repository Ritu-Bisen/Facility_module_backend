const db = require('../src/config/db');
const oracledb = require('oracledb');
async function run() {
  try {
    await db.initialize();
    const result = await db.execute("SELECT * FROM MASFACILITYWARDS WHERE ROWNUM <= 10");
    console.log(result.rows);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
