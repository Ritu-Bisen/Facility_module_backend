require('dotenv').config();
const db = require('./src/config/db');

async function test() {
  try {
    await db.initialize();
    
    const sql = `SELECT column_name FROM user_tab_columns WHERE table_name = 'LPMASITEMS'`;
    const res = await db.execute(sql, {}, { outFormat: 4002 });
    console.log(res.rows.map(r => r.COLUMN_NAME || r.column_name));
    
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    process.exit(0);
  }
}
test();
