const db = require('../src/config/db');
const oracledb = require('oracledb');

async function run() {
  try {
    await db.initialize();

    console.log("=== MASITEMCATEGORIES ===");
    const catRes = await db.execute(
      "SELECT * FROM masitemcategories WHERE ROWNUM <= 20",
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    console.log(catRes.rows);

    console.log("\n=== MASANUALINDENT SAMPLE ===");
    const indRes = await db.execute(
      "SELECT indentid, indentno, aicategoryid FROM masanualindent WHERE ROWNUM <= 10",
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    console.log(indRes.rows);

  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
