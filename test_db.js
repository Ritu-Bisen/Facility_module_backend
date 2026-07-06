const db = require('./src/config/db');
const oracledb = require('oracledb');
async function test() {
  try {
    await db.initialize();
    const query = `SELECT itemid, itemcode, itemname FROM masitems WHERE categoryid IN (SELECT categoryid FROM masitemcategory WHERE mcid IN (SELECT mcid FROM masitemmaincategory WHERE mcategory = 'Drugs')) ORDER BY itemname`;
    const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    console.log('Rows:', result.rows.length);
    console.log('Sample:', result.rows[0]);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
test();
