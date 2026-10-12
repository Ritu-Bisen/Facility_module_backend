require('dotenv').config({ path: './.env' });
const db = require('./src/config/db');

async function test() {
  try {
    const r = await db.execute(
      "SELECT ft.FACILITYTYPEID, ft.FACILITYTYPECODE, ft.FACILITYTYPEDESC, ft.HODID FROM MASFACILITYTYPES ft WHERE ft.HODID = 3 OR UPPER(ft.FACILITYTYPEDESC) LIKE '%AYUSH%' OR UPPER(ft.FACILITYTYPECODE) LIKE '%AYUSH%'",
      []
    );
    console.log('AYUSH Facility Types in DB:', JSON.stringify(r.rows, null, 2));

    const u = await db.execute(
      "SELECT u.USERID, u.EMAILID, u.FACILITYID, f.FACILITYNAME, f.FACILITYTYPEID, ft.HODID, ft.FACILITYTYPECODE, ft.FACILITYTYPEDESC, r.ROLENAME FROM USRUSERS u INNER JOIN MASFACILITIES f ON u.FACILITYID = f.FACILITYID INNER JOIN MASFACILITYTYPES ft ON f.FACILITYTYPEID = ft.FACILITYTYPEID LEFT JOIN USRUSERROLE ur ON u.USERID = ur.USERID LEFT JOIN USRROLES r ON ur.ROLEID = r.ROLEID WHERE (ft.HODID = 3 OR UPPER(ft.FACILITYTYPEDESC) LIKE '%AYUSH%' OR UPPER(u.EMAILID) LIKE '%AYUSH%') AND ROWNUM <= 10",
      []
    );
    console.log('Sample AYUSH users:', JSON.stringify(u.rows, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
test();
