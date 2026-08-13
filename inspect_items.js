const db = require('./src/config/db');
require('dotenv').config();

async function test() {
  try {
    await db.initialize();
    
    // Check LPMasItems
    const lpRes = await db.execute(`
      SELECT * FROM LPMasItems WHERE LPItemID IN (10832, 10355)
    `, {}, { outFormat: 4002 });
    console.log('LPMasItems:', lpRes.rows);
    
    // Check VMASITEMS
    const vmasRes = await db.execute(`
      SELECT ITEMID, ITEMCODE, ITEMNAME, STRENGTH1, UNIT FROM VMASITEMS WHERE ITEMID IN (10832, 10355)
    `, {}, { outFormat: 4002 });
    console.log('VMASITEMS:', vmasRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await db.close();
  }
}
test();
