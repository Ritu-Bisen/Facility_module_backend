const db = require('./src/config/db');

async function test() {
  await db.initialize();
  try {
    const res = await db.execute(`
      SELECT IssueNo, LENGTH(IssueNo) as len, DUMP(IssueNo) as dump
      FROM tbFacilityIssues 
      WHERE IssueNo LIKE '01109/TR/%' 
      ORDER BY IssueNo DESC
      FETCH FIRST 5 ROWS ONLY
    `);
    console.log(res.rows);
  } finally {
    await db.close();
  }
}
test();
