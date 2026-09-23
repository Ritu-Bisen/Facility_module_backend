const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../src/config/db');
const oracledb = require('oracledb');

async function testProgramItems() {
  try {
    console.log('Testing query for program items...');
    await db.initialize();

    const summaryQuery = `
      select p.programid, p.program, count(pi.itemid) as item_count
      from masprogram p
      left outer join masprogramitems pi on pi.programid = p.programid
      group by p.programid, p.program
      order by item_count desc, p.program
    `;
    const res = await db.execute(summaryQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    console.log('Programs with item counts:');
    res.rows.forEach(r => {
      console.log(`Program ID ${r.PROGRAMID}: "${r.PROGRAM}" -> ${r.ITEM_COUNT} items`);
    });

  } catch (err) {
    console.error('Query test error:', err);
  } finally {
    process.exit(0);
  }
}

testProgramItems();
