const db = require('./src/config/db');
require('dotenv').config();

async function run() {
  await db.initialize();
  const result = await db.execute("SELECT column_name, data_type FROM user_tab_columns WHERE table_name = 'MASFACTRANSFERS'");
  console.log(result.rows);
  process.exit(0);
}
run();
