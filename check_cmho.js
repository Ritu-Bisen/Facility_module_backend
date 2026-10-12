require('dotenv').config({ path: './.env' });
const db = require('./src/config/db');

async function test() {
  try {
    const r = await db.execute("SELECT ROLEID, ROLENAME FROM USRROLES WHERE UPPER(ROLENAME) LIKE '%CMHO%'");
    console.log('Roles with CMHO:', JSON.stringify(r.rows, null, 2));
    const r2 = await db.execute("SELECT FACILITYTYPEID, FACILITYTYPECODE, FACILITYTYPEDESC FROM MASFACILITYTYPES WHERE UPPER(FACILITYTYPECODE) LIKE '%CMHO%' OR UPPER(FACILITYTYPEDESC) LIKE '%CMHO%'");
    console.log('Facility types with CMHO:', JSON.stringify(r2.rows, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
test();
