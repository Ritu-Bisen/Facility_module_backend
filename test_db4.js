const db = require('./src/config/db');
const oracledb = require('oracledb');
async function test() {
  try {
    await db.initialize();
    
    let query = `
      SELECT column_name, data_type 
      FROM all_tab_columns 
      WHERE table_name IN ('TBFACILITYRECEIPTBATCHES', 'V_FACILITYSTOCK1', 'TBFACILITYRECEIPTS')
    `;
    const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    console.log(result.rows);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
test();
