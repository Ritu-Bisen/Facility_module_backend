const db = require('./src/config/db');
require('dotenv').config();

async function test() {
  try {
    await db.initialize();
    
    // Check mascgmscnoc for NOCID 334532 or 330770
    const res = await db.execute(`
      SELECT NOCID, NocNumber FROM mascgmscnoc WHERE NOCID IN (334532, 330770)
    `, {}, { outFormat: 4002 });
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await db.close();
  }
}
test();
