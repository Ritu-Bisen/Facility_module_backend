const db = require('./src/config/db');

async function run() {
  await db.initialize();
  const result = await db.execute(`SELECT column_name, data_type FROM user_tab_columns WHERE table_name = 'USRUSERS'`);
  console.log(result.rows);
  await db.close();
}

run().catch(console.error);
