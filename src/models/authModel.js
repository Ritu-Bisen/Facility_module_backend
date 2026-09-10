const db = require('../config/db');
const oracledb = require('oracledb');

/**
 * Find user by email for login
 * Joins usrusers with masfacheaderfooter to get footer data
 */
async function findByEmail(email) {
  const sql = `SELECT u.PWD, u.EMAILID, u.USERID, u.FIRSTNAME, u.LASTNAME,
                      u.STATUS, u.OTP, u.OTPUPDATEDT, u.FACILITYID, u.ROLEID,
                      u.FAILED_ATTEMPTS, u.LOCKOUT_UNTIL,
                      f.FOOTER1, f.FOOTER2, f.FOOTER3,
                      r.ROLENAME
               FROM USRUSERS u
               LEFT JOIN MASFACHEADERFOOTER f ON f.USERID = u.USERID
               LEFT JOIN USRROLES r ON u.ROLEID = r.ROLEID
               WHERE UPPER(u.EMAILID) = UPPER(:email)`;

  const result = await db.execute(sql, { email }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows;
}

/**
 * Find user by phone number (stored in MASFACHEADERFOOTER.FOOTER3) for login
 * FOOTER3 column holds the mobile number
 */
async function findByPhone(phoneNo) {
  const sql = `SELECT u.PWD, u.EMAILID, u.USERID, u.FIRSTNAME, u.LASTNAME,
                      u.STATUS, u.OTP, u.OTPUPDATEDT, u.FACILITYID, u.ROLEID,
                      u.FAILED_ATTEMPTS, u.LOCKOUT_UNTIL,
                      f.FOOTER1, f.FOOTER2, f.FOOTER3,
                      r.ROLENAME
               FROM USRUSERS u
               LEFT JOIN MASFACHEADERFOOTER f ON f.USERID = u.USERID
               LEFT JOIN USRROLES r ON u.ROLEID = r.ROLEID
               WHERE f.FOOTER3 = :phoneNo`;

  const result = await db.execute(sql, { phoneNo }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows;
}

/**
 * Find user by Email, Phone Number (FOOTER3 / DEPMOBILE), or User ID
 */
async function findByIdentifier(identifier) {
  const cleanId = String(identifier).trim();
  const sql = `SELECT u.PWD, u.EMAILID, u.USERID, u.FIRSTNAME, u.LASTNAME,
                      u.STATUS, u.OTP, u.OTPUPDATEDT, u.FACILITYID, u.ROLEID,
                      u.FAILED_ATTEMPTS, u.LOCKOUT_UNTIL,
                      f.FOOTER1, f.FOOTER2, f.FOOTER3,
                      r.ROLENAME
               FROM USRUSERS u
               LEFT JOIN MASFACHEADERFOOTER f ON f.USERID = u.USERID
               LEFT JOIN USRROLES r ON u.ROLEID = r.ROLEID
               WHERE UPPER(u.EMAILID) = UPPER(:cleanId)
                  OR f.FOOTER3 = :cleanId
                  OR u.DEPMOBILE = :cleanId
                  OR TO_CHAR(u.USERID) = :cleanId`;

  const result = await db.execute(sql, { cleanId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows;
}

/**
 * Save OTP Record into OTPRECORD table
 */
async function saveOtpRecord(userId, otp, mobNo) {
  try {
    const sql = `INSERT INTO OTPRECORD (UPDATEDT, OTP, MOB, USERID, ENTRYDATE, ISLOGIN) 
                 VALUES (SYSDATE, :otp, :mobNo, :userId, SYSDATE, 'Y')`;
    await db.execute(sql, { otp, mobNo: String(mobNo || ''), userId }, { autoCommit: true });
  } catch (err) {
    // Graceful fallback if table structure or table does not exist
  }
}

/**
 * Save SMS log entry into SMSLOG table
 */
async function saveSmsLog(mobNo, smsMessage, module, templateId, ipAddress) {
  try {
    const sql = `INSERT INTO SMSLOG (MOBNO, SMS, ENTRYDATE, MODULE, TEMPLATEID, IPADDRESS) 
                 VALUES (:mobNo, :smsMessage, SYSDATE, :module, :templateId, :ipAddress)`;
    await db.execute(sql, { 
      mobNo: String(mobNo || ''), 
      smsMessage, 
      module: module || 'HO_API_login', 
      templateId: templateId || '1407161537152057950', 
      ipAddress: ipAddress || '127.0.0.1' 
    }, { autoCommit: true });
  } catch (err) {
    // Graceful fallback if table structure or table does not exist
  }
}

/**
 * Update the OTP and OTPUPDATEDT for a user
 */
async function updateOTP(userId, otp) {
  const sql = `UPDATE USRUSERS 
               SET OTP = :otp, 
                   OTPUPDATEDT = SYSDATE 
               WHERE USERID = :userId`;
  
  await db.execute(sql, { otp, userId }, { autoCommit: true });
}

async function findUserById(userId) {
  const sql = `SELECT PWD, EMAILID, USERID, STATUS FROM USRUSERS WHERE USERID = :userId`;
  const result = await db.execute(sql, { userId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows[0];
}

async function findFullUserById(userId) {
  const sql = `SELECT u.PWD, u.EMAILID, u.USERID, u.FIRSTNAME, u.LASTNAME,
                      u.STATUS, u.OTP, u.OTPUPDATEDT, u.FACILITYID, u.ROLEID,
                      f.FOOTER1, f.FOOTER2, f.FOOTER3,
                      r.ROLENAME
               FROM USRUSERS u
               LEFT JOIN MASFACHEADERFOOTER f ON f.USERID = u.USERID
               LEFT JOIN USRROLES r ON u.ROLEID = r.ROLEID
               WHERE u.USERID = :userId`;
  const result = await db.execute(sql, { userId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows[0];
}

async function updatePassword(userId, newHashedPassword) {
  const sql = `UPDATE USRUSERS SET PWD = :newHashedPassword WHERE USERID = :userId`;
  await db.execute(sql, { newHashedPassword, userId }, { autoCommit: true });
}

async function insertAuditLog(userId, operation, ipAddress) {
  const sql = `
    INSERT INTO GENAUDITLOGS (UserID, OPERATION, LOGDATE, IPAddress) 
    VALUES (:userId, :operation, SYSDATE, :ipAddress)
  `;
  await db.execute(sql, { userId, operation, ipAddress: ipAddress || '0.0.0.0' }, { autoCommit: true });
}

async function updateSessionId(userId, sessionId) {
  const sql = `UPDATE USRUSERS SET SESSION_ID = :sessionId WHERE USERID = :userId`;
  await db.execute(sql, { sessionId, userId }, { autoCommit: true });
}

async function incrementFailedAttempts(userId) {
  const sql = `UPDATE USRUSERS SET FAILED_ATTEMPTS = NVL(FAILED_ATTEMPTS, 0) + 1 WHERE USERID = :userId`;
  await db.execute(sql, { userId }, { autoCommit: true });
}

async function lockAccount(userId, lockoutMinutes) {
  const sql = `UPDATE USRUSERS SET LOCKOUT_UNTIL = SYSDATE + (:lockoutMinutes / 1440) WHERE USERID = :userId`;
  await db.execute(sql, { lockoutMinutes, userId }, { autoCommit: true });
}

async function resetFailedAttempts(userId) {
  const sql = `UPDATE USRUSERS SET FAILED_ATTEMPTS = 0, LOCKOUT_UNTIL = NULL WHERE USERID = :userId`;
  await db.execute(sql, { userId }, { autoCommit: true });
}

async function getSessionId(userId) {
  const sql = `SELECT SESSION_ID FROM USRUSERS WHERE USERID = :userId`;
  const result = await db.execute(sql, { userId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows.length > 0 ? result.rows[0].SESSION_ID : null;
}

module.exports = {
  findByEmail,
  findByPhone,
  findByIdentifier,
  saveOtpRecord,
  saveSmsLog,
  updateOTP,
  findUserById,
  findFullUserById,
  updatePassword,
  insertAuditLog,
  updateSessionId,
  getSessionId,
  incrementFailedAttempts,
  lockAccount,
  resetFailedAttempts
};
