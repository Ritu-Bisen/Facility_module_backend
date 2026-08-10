require('dotenv').config({ path: './.env' });
const db = require('./src/config/db');

async function test() {
  await db.initialize();
  try {
    await db.execute(`UPDATE usrScreens SET ISSUBNEW = 'Y' WHERE ScreenID IN (3163, 3465, 3466)`);
    await db.execute(`UPDATE usrModules SET ISNEW = 'Y' WHERE ModuleID IN (5, 6, 61)`);
    await db.execute(`COMMIT`);
    console.log("Updated DB");
  } catch (err) {
    console.error(err);
  } finally {
    await db.close();
  }
}

test();
