const db = require('../config/db');
const oracledb = require('oracledb');

/**
 * Find user by email for login
 * Joins usrusers with masfacheaderfooter to get footer data
 */
async function findByEmail(email) {
  const sql = `SELECT u.PWD, u.EMAILID, u.USERID, u.FIRSTNAME, u.LASTNAME,
                      u.STATUS, u.OTP, u.OTPUPDATEDT, u.FACILITYID, u.ROLEID,
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
  // Session ID feature is disabled as the column is not in the database
  return Promise.resolve();
}

module.exports = {
  findByEmail,
  findByPhone,
  updateOTP,
  findUserById,
  findFullUserById,
  updatePassword,
  insertAuditLog,
  updateSessionId
};
