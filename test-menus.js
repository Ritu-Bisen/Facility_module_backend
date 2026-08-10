require('dotenv').config({path:'backend/.env'});
const db = require('./src/config/db');
const userService = require('./src/services/userService');

(async () => {
  try {
    await db.initialize();
    const result = await db.execute("SELECT UserID FROM usrUsers WHERE EmailID='chctilda@dpdmis.in'", [], { outFormat: 4002 });
    const u = result.rows[0];
    console.log('UserID:', u.USERID);
    const menus = await userService.getUserMenus(u.USERID);
    console.log('MENUS:', JSON.stringify(menus, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();
