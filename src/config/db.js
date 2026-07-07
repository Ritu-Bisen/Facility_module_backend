const oracledb = require('oracledb');
const path = require('path');
const logger = require('../utils/logger');
require('dotenv').config();

async function initialize() {
  try {
    // Extract just the folder name if WALLET_DIR is accidentally set as a full Windows path
    let walletDirName = process.env.WALLET_DIR || 'wallet';
    if (walletDirName.includes('\\') || walletDirName.includes('/')) {
        walletDirName = path.basename(walletDirName.replace(/\\/g, '/'));
    }
    
    const walletPath = path.resolve(__dirname, '../../', walletDirName);
    logger.info(`Initializing Oracle DB (Thin Mode) with wallet directory: ${walletPath}`);
    
    // Removed oracledb.initOracleClient() to use pure JS Thin Mode which works on Render natively
    
    await oracledb.createPool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
      walletLocation: walletPath,
      walletPassword: process.env.WALLET_PASSWORD || process.env.DB_PASSWORD,
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 2
    });
    
    logger.info('Oracle database connection pool created in Thin Mode.');
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
    const result = await connection.execute(sql, binds, opts);
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
