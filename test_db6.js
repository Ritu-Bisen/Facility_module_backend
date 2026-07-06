const db = require('./src/config/db');
const oracledb = require('oracledb');
async function test() {
  try {
    await db.initialize();
    
    let query = `
      SELECT table_name 
      FROM all_tables 
      WHERE table_name LIKE '%BATCH%LOC%' OR table_name LIKE '%LOC%' AND table_name LIKE '%FACILITY%'
    `;
    const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    console.log('Tables:');
    console.log(result.rows);

    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
test();
