const db = require('../src/config/db');
const oracledb = require('oracledb');

async function run() {
  try {
    await db.initialize();

    console.log("=== MASSUBITEMCATEGORY ===");
    try {
      const subRes = await db.execute(
        "SELECT * FROM MASSUBITEMCATEGORY",
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      console.log(subRes.rows);
    } catch (e) {
      console.error(e.message);
    }

    console.log("=== MASITEMMAINCATEGORY ===");
    try {
      const mainRes = await db.execute(
        "SELECT * FROM MASITEMMAINCATEGORY",
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      console.log(mainRes.rows);
    } catch (e) {
      console.error(e.message);
    }

  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
