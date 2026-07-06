const db = require('./src/config/db');
const oracledb = require('oracledb');
async function test() {
  try {
    await db.initialize();
    const query = `SELECT table_name FROM user_tables WHERE table_name LIKE 'MASITEM%'`;
    const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    console.log('Tables:', result.rows);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
test();
