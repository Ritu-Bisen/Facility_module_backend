const oracledb = require('oracledb');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function checkContracts() {
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
      `SELECT contractid as "id", 'Contract No : ' || contractno || '- Contract Date : ' || to_char(contractdate, 'dd-MM-yyyy') as "name" FROM lpcontracts WHERE accyrsetid = 542 AND lpsupplierid = 1378`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    console.log("Result:", result.rows);
  } catch (err) {
    console.error("DB Error:", err);
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

checkContracts();
