const oracledb = require('oracledb');
const path = require('path');
const logger = require('../utils/logger');
require('dotenv').config();

let pool = null;

function getWalletPath() {
  return process.env.WALLET_DIR
    ? path.resolve(__dirname, '../../', process.env.WALLET_DIR)
    : path.resolve(__dirname, '../../Wallet_cgmsclm');
}

async function getPool() {
  if (pool) return pool;

  const walletPath = getWalletPath();
  process.env.TNS_ADMIN = walletPath;

  pool = await oracledb.createPool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    walletLocation: walletPath,
    walletPassword: process.env.WALLET_PASSWORD,
    poolMin: 1,
    poolMax: 15,
    poolIncrement: 1,
    poolTimeout: 300,
    queueTimeout: 30000,
    enableStatistics: false
  });

  logger.info('Oracle Database connection pool initialized successfully');
  return pool;
}

async function initialize() {
  try {
    const walletPath = getWalletPath();
    process.env.TNS_ADMIN = walletPath;
    logger.info(`Oracle Client configured with wallet directory: ${walletPath}`);
    await getPool();
  } catch (err) {
    logger.error('Error initializing Oracle DB Pool: ' + err.message);
  }
}

async function close() {
  try {
    if (pool) {
      await pool.close(10);
      pool = null;
      logger.info('Oracle Database connection pool closed gracefully');
    }
  } catch (err) {
    logger.error('Error closing Oracle DB Pool: ' + err.message);
  }
}

async function execute(sql, binds = [], opts = {}) {
  let connection;
  const maxRetries = 2;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const p = await getPool();
      connection = await p.getConnection();

      const options = { autoCommit: true, ...opts };
      const result = await connection.execute(sql, binds, options);
      return result;
    } catch (err) {
      attempt++;
      const isConnectionError = /NJS-|ORA-12170|ORA-12541|ORA-03113|ORA-03114|ORA-12514|DPI-1080/i.test(err.message);
      if (isConnectionError && attempt <= maxRetries) {
        logger.warn(`Database connection error, retrying (${attempt}/${maxRetries}): ${err.message}`);
        try {
          if (pool) {
            await pool.close(10);
          }
        } catch (_) {}
        pool = null;
        await new Promise((r) => setTimeout(r, 500 * attempt));
        continue;
      }
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
}

async function getConnection() {
  const p = await getPool();
  return await p.getConnection();
}

module.exports = {
  initialize,
  close,
  execute,
  getConnection,
  oracledb
};
