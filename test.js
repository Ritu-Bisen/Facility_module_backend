require('dotenv').config();
const db = require('./src/config/db');

async function test() {
  await db.initialize();
  const sql = `
    SELECT column_name, data_type 
    FROM all_tab_columns 
    WHERE table_name = 'TBFACILITYISSUES'
  `;
  try {
    const res = await db.execute(sql, {}, {});
    console.log(res.rows);
  } catch(e) {
    console.error('DB ERROR:', e.message);
  }
  process.exit();
}
test();
