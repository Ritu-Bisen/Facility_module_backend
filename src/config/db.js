const oracledb = require('oracledb');
const path = require('path');
const logger = require('../utils/logger');
require('dotenv').config();

function getWalletPath() {
  return process.env.WALLET_DIR
    ? path.resolve(__dirname, '../../', process.env.WALLET_DIR)
    : path.resolve(__dirname, '../../Wallet_cgmsclm');
}

async function initialize() {
  try {
    const walletPath = getWalletPath();
    process.env.TNS_ADMIN = walletPath;
    logger.info(`Oracle Client configured with wallet directory: ${walletPath}`);
  } catch (err) {
    logger.error('Error initializing Oracle DB: ' + err.message);
  }
}

async function close() {
  // Graceful cleanup
}

async function execute(sql, binds = [], opts = {}) {
  let connection;
  const walletPath = getWalletPath();
  process.env.TNS_ADMIN = walletPath;

  try {
    connection = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
      walletLocation: walletPath,
      walletPassword: process.env.WALLET_PASSWORD
    });

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
        // Ignore closing error
      }
    }
  }
}

async function getConnection() {
  const walletPath = getWalletPath();
  process.env.TNS_ADMIN = walletPath;

  return await oracledb.getConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    walletLocation: walletPath,
    walletPassword: process.env.WALLET_PASSWORD
  });
}

module.exports = {
  initialize,
  close,
  execute,
  getConnection,
  oracledb
};
