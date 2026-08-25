const db = require('../config/db');
const logger = require('../utils/logger');

/**
 * Safely slice string fields to match Oracle VARCHAR2 column limits.
 */
function sanitizeString(str, maxLength) {
  if (!str) return null;
  const stringified = String(str).trim();
  return stringified.length > maxLength ? stringified.substring(0, maxLength) : stringified;
}

/**
 * Safely parse numbers.
 */
function sanitizeNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

/**
 * Insert a new log entry into USERS_LOGS table.
 * If log is for today (ISLATEST = 'Y'), update previous days' logs for the user to ISLATEST = 'N'.
 * @param {Object} logData
 */
async function insertLog(logData) {
  const sanitizedUserId = sanitizeNumber(logData.userId);
  const isLatestVal = sanitizeString(logData.isLatest || 'Y', 1);
  const systemTypeVal = sanitizeString(logData.systemType || 'facilitymodule', 50);

  // Update previous days' logs to ISLATEST = 'N' when inserting today's activity
  if (isLatestVal === 'Y') {
    try {
      if (sanitizedUserId) {
        await db.execute(
          `UPDATE USERS_LOGS 
           SET ISLATEST = 'N' 
           WHERE USER_ID = :userId 
             AND ISLATEST = 'Y' 
             AND TRUNC(CREATED_AT) < TRUNC(SYSDATE)`,
          { userId: sanitizedUserId },
          { autoCommit: true }
        );
      } else {
        await db.execute(
          `UPDATE USERS_LOGS 
           SET ISLATEST = 'N' 
           WHERE ISLATEST = 'Y' 
             AND TRUNC(CREATED_AT) < TRUNC(SYSDATE)`,
          [],
          { autoCommit: true }
        );
      }
    } catch (updateErr) {
      logger.error('Failed to update previous USERS_LOGS ISLATEST flag: ' + updateErr.message);
    }
  }

  const sql = `
    INSERT INTO USERS_LOGS (
      ID, USER_ID, USER_ROLE, ROLEID, ACTION, ROUTE, METHOD,
      IP_ADDRESS, DESCRIPTION, LOG_CATEGORY, CREATED_AT, ISLATEST,
      SYSTEMTYPE, MAC_ADDRESS, LATITUDE, LONGITUDE, ERROR_MESSAGE,
      API_ENDPOINT, DEVICE_TYPE, FACILITIES
    ) VALUES (
      USERS_LOGS_ID_SEQ.NEXTVAL, :userId, :userRole, :roleId, :action, :route, :method,
      :ipAddress, :description, :logCategory, SYSDATE, :isLatest,
      :systemType, :macAddress, :latitude, :longitude, :errorMessage,
      :apiEndpoint, :deviceType, :facilities
    )
  `;

  const binds = {
    userId: sanitizedUserId,
    userRole: sanitizeString(logData.userRole, 20),
    roleId: sanitizeNumber(logData.roleId),
    action: sanitizeString(logData.action, 20),
    route: sanitizeString(logData.route, 20),
    method: sanitizeString(logData.method, 20),
    ipAddress: sanitizeString(logData.ipAddress, 20),
    description: sanitizeString(logData.description, 100),
    logCategory: sanitizeString(logData.logCategory || 'SYSTEM', 30),
    isLatest: isLatestVal,
    systemType: systemTypeVal,
    macAddress: sanitizeString(logData.macAddress, 100),
    latitude: sanitizeNumber(logData.latitude),
    longitude: sanitizeNumber(logData.longitude),
    errorMessage: sanitizeString(logData.errorMessage, 2000),
    apiEndpoint: sanitizeString(logData.apiEndpoint, 500),
    deviceType: sanitizeString(logData.deviceType, 50),
    facilities: sanitizeString(logData.facilities, 100)
  };

  try {
    await db.execute(sql, binds, { autoCommit: true });
  } catch (error) {
    logger.error('Failed to insert log into USERS_LOGS: ' + error.message);
  }
}

/**
 * Fetch logs with optional filtering and pagination.
 */
async function getLogs({ userId, action, logCategory, isLatest, limit = 50, offset = 0 } = {}) {
  let whereClauses = [];
  const binds = {};

  if (userId) {
    whereClauses.push('USER_ID = :userId');
    binds.userId = Number(userId);
  }
  if (action) {
    whereClauses.push('UPPER(ACTION) = UPPER(:action)');
    binds.action = action;
  }
  if (logCategory) {
    whereClauses.push('UPPER(LOG_CATEGORY) = UPPER(:logCategory)');
    binds.logCategory = logCategory;
  }
  if (isLatest) {
    whereClauses.push('ISLATEST = :isLatest');
    binds.isLatest = isLatest;
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT 
      ID, USER_ID, USER_ROLE, ROLEID, ACTION, ROUTE, METHOD,
      IP_ADDRESS, DESCRIPTION, LOG_CATEGORY, CREATED_AT, ISLATEST,
      SYSTEMTYPE, MAC_ADDRESS, LATITUDE, LONGITUDE, ERROR_MESSAGE,
      API_ENDPOINT, DEVICE_TYPE, FACILITIES
    FROM USERS_LOGS
    ${whereSql}
    ORDER BY CREATED_AT DESC, ID DESC
    OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
  `;

  binds.offset = Number(offset) || 0;
  binds.limit = Number(limit) || 50;

  const result = await db.execute(sql, binds);
  
  const rows = result.rows || [];
  return rows.map(r => ({
    id: r[0],
    userId: r[1],
    userRole: r[2],
    roleId: r[3],
    action: r[4],
    route: r[5],
    method: r[6],
    ipAddress: r[7],
    description: r[8],
    logCategory: r[9],
    createdAt: r[10],
    isLatest: r[11],
    systemType: r[12],
    macAddress: r[13],
    latitude: r[14],
    longitude: r[15],
    errorMessage: r[16],
    apiEndpoint: r[17],
    deviceType: r[18],
    facilities: r[19]
  }));
}

/**
 * Fetch a single log by ID.
 */
async function getLogById(id) {
  const sql = `
    SELECT 
      ID, USER_ID, USER_ROLE, ROLEID, ACTION, ROUTE, METHOD,
      IP_ADDRESS, DESCRIPTION, LOG_CATEGORY, CREATED_AT, ISLATEST,
      SYSTEMTYPE, MAC_ADDRESS, LATITUDE, LONGITUDE, ERROR_MESSAGE,
      API_ENDPOINT, DEVICE_TYPE, FACILITIES
    FROM USERS_LOGS
    WHERE ID = :id
  `;

  const result = await db.execute(sql, { id: Number(id) });
  const rows = result.rows || [];
  if (rows.length === 0) return null;

  const r = rows[0];
  return {
    id: r[0],
    userId: r[1],
    userRole: r[2],
    roleId: r[3],
    action: r[4],
    route: r[5],
    method: r[6],
    ipAddress: r[7],
    description: r[8],
    logCategory: r[9],
    createdAt: r[10],
    isLatest: r[11],
    systemType: r[12],
    macAddress: r[13],
    latitude: r[14],
    longitude: r[15],
    errorMessage: r[16],
    apiEndpoint: r[17],
    deviceType: r[18],
    facilities: r[19]
  };
}

module.exports = {
  insertLog,
  getLogs,
  getLogById
};
