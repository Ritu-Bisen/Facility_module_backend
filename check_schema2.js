const oracledb = require('oracledb');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function checkSchema() {
  let connection;
  try {
    const walletPath = process.env.WALLET_DIR
      ? path.resolve(__dirname, process.env.WALLET_DIR)
      : path.resolve(__dirname, 'wallet');
    
    process.env.TNS_ADMIN = walletPath;

    connection = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
      walletLocation: walletPath,
      walletPassword: process.env.WALLET_PASSWORD
    });

    const result = await connection.execute(
      `SELECT column_name, data_type, nullable FROM user_tab_columns WHERE table_name = 'LPCONTRACTITEMS'`
    );
    console.log("LPCONTRACTITEMS columns:", result.rows);
    
    const dataResult = await connection.execute(
      `SELECT ISACTIVE FROM LPCONTRACTITEMS WHERE ROWNUM <= 5`
    );
    console.log("Existing ISACTIVE values:", dataResult.rows);

  } catch (err) {
    console.error(err);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
}

checkSchema();
