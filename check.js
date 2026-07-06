require('dotenv').config();
const db = require('./src/config/db');

async function test() {
  try {
    await db.initialize();
    const result = await db.execute(`
      SELECT column_name 
      FROM all_tab_columns 
      WHERE table_name = 'MASCGMSCNOCITEMS'
    `);
    console.log(result.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await db.close();
  }
}

test();
