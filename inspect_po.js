const db = require('./src/config/db');
require('dotenv').config();

async function test() {
  try {
    await db.initialize();
    const res = await db.execute(`
      SELECT * FROM LPsoOrderedItems WHERE PoNoID = 98991
    `, {}, { outFormat: 4002 });
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await db.close();
  }
}
test();
