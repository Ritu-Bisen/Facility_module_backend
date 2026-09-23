const db = require('../src/config/db');
const oracledb = require('oracledb');

async function run() {
  try {
    await db.initialize();

    console.log("=== MASPROGRAM TABLE ===");
    const pRes = await db.execute(
      "SELECT programid, program, isactive FROM masprogram WHERE rownum <= 30 ORDER BY programid",
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    console.log(pRes.rows);

  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
