const db = require('./src/config/db');

async function test() {
  await db.initialize();
  try {
    const res = await db.execute(`
      SELECT IssueNo, IssueDate 
      FROM tbFacilityIssues 
      WHERE IssueNo LIKE '01109/TR/%/26-27' 
      ORDER BY IssueNo DESC
    `);
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await db.close();
  }
}

test();
