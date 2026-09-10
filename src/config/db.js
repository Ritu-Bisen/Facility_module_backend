const oracledb = require('oracledb');
const path = require('path');
const logger = require('../utils/logger');
require('dotenv').config();

async function initialize() {
  try {
    const walletPath = process.env.WALLET_DIR
      ? path.resolve(__dirname, '../../', process.env.WALLET_DIR)
      : path.resolve(__dirname, '../../wallet');
    logger.info(`Initializing Oracle Client with wallet directory: ${walletPath}`);
    
    // Ensure node-oracledb can find tnsnames.ora and sqlnet.ora in Thin mode
    process.env.TNS_ADMIN = walletPath;
    
    // In node-oracledb v6+, we do not call initOracleClient if we want to use Thin mode
    // (Thick mode requires Oracle Instant Client installed, causing DPI-1047 if missing).
    
    await oracledb.createPool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
      walletLocation: walletPath, // Explicitly tell node-oracledb where the wallet is
      walletPassword: process.env.WALLET_PASSWORD,
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 2
    });
    
    logger.info('Oracle database connection pool created.');
  } catch (err) {
    logger.error('Error initializing Oracle DB: ' + err.message);
    throw err;
  }
}

async function close() {
  try {
    await oracledb.getPool().close(10);
    logger.info('Oracle database connection pool closed.');
  } catch (err) {
    logger.error('Error closing Oracle DB pool: ' + err.message);
  }
}

async function execute(sql, binds = [], opts = {}) {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const options = { autoCommit: true, ...opts };
    const result = await connection.execute(sql, binds, options);
    return result;
  } catch (err) {
    logger.error('Database execution error: ' + err.message);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        logger.error('Error closing connection: ' + err.message);
      }
    }
  }
}

module.exports = {
  initialize,
  close,
  execute
};
