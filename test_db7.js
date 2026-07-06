const db = require('./src/config/db');
const oracledb = require('oracledb');

async function testQuery() {
  try {
    await db.initialize();
    
    const query = `
      SELECT b.batchno, loc.STOCKLOCATION
      FROM tbfacilityreceiptbatches b
      LEFT OUTER JOIN tbfacilityreceiptbatchlocations loc ON loc.batchid = b.batchid
      WHERE ROWNUM <= 1
    `;
    const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    console.log(result.rows);

    process.exit(0);
  } catch(e) {
    console.error(e.message);
    process.exit(1);
  }
}

testQuery();
