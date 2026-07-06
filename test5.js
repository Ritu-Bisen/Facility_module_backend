const db = require('./src/config/db');

async function test() {
  await db.initialize();
  try {
    const res = await db.execute(`
      SELECT SHAccYear
      FROM masAccYearSettings
      WHERE TRUNC(SYSDATE) BETWEEN StartDate AND EndDate
    `);
    console.log("Current SHAccYear:", res.rows);
  } finally {
    await db.close();
  }
}
test();
