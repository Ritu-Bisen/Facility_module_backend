const oracledb = require('oracledb');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function run() {
  const p = path.resolve(__dirname, process.env.WALLET_DIR);
  process.env.TNS_ADMIN = p;
  const c = await oracledb.getConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    walletLocation: p,
    walletPassword: process.env.WALLET_PASSWORD
  });
  const res = await c.execute("SELECT column_name, data_type FROM all_tab_columns WHERE table_name = 'LPCONTRACTITEMS'", [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
  console.log(res.rows);
  await c.close();
}
run();
