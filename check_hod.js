require('dotenv').config({ path: './.env' });
const db = require('./src/config/db');

async function test() {
  try {
    const r = await db.execute("SELECT * FROM MASHOD");
    console.log('MASHOD:', JSON.stringify(r.rows, null, 2));
  } catch(e) {
    try {
      const r2 = await db.execute("SELECT TABLE_NAME FROM USER_TABLES WHERE TABLE_NAME LIKE '%HOD%'");
      console.log('HOD tables:', JSON.stringify(r2.rows, null, 2));
    } catch(err2) {
      console.error(err2);
    }
  } finally {
    process.exit(0);
  }
}
test();
