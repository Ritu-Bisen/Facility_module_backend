const db = require('../config/db');
const oracledb = require('oracledb');

/**
 * Find user by email for login
 * Joins usrusers with masfacheaderfooter to get footer data
 */
async function findByEmail(email) {
  const cleanEmail = String(email || '').trim();
  try {
    const sql = `SELECT u.PWD, u.EMAILID, u.USERID, u.FIRSTNAME, u.LASTNAME,
                        u.STATUS, u.OTP, u.OTPUPDATEDT, u.FACILITYID, u.ROLEID,
                        u.FAILED_ATTEMPTS, u.LOCKOUT_UNTIL,
                        (CASE WHEN u.LOCKOUT_UNTIL IS NOT NULL AND u.LOCKOUT_UNTIL > SYSDATE THEN CEIL((u.LOCKOUT_UNTIL - SYSDATE) * 1440) ELSE 0 END) AS MINUTES_LOCKED,
                        f.FOOTER1, f.FOOTER2, f.FOOTER3,
                        r.ROLENAME,
                        fac.FACILITYTYPEID,
                        ft.FACILITYTYPECODE,
                        ft.FACILITYTYPEDESC AS FACILITYTYPENAME,
                        fac.FACILITYNAME, ft.HODID
                 FROM USRUSERS u
                 LEFT JOIN MASFACHEADERFOOTER f ON f.USERID = TO_CHAR(u.USERID)
                 LEFT JOIN USRROLES r ON u.ROLEID = r.ROLEID
                 LEFT JOIN MASFACILITIES fac ON u.FACILITYID = fac.FACILITYID
                 LEFT JOIN MASFACILITYTYPES ft ON fac.FACILITYTYPEID = ft.FACILITYTYPEID
                 WHERE TRIM(UPPER(u.EMAILID)) = TRIM(UPPER(:cleanEmail))
                 ORDER BY CASE WHEN u.STATUS = 'A' THEN 1 ELSE 2 END, u.USERID DESC`;

    const result = await db.execute(sql, { cleanEmail }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows || [];
  } catch (err) {
    try {
      const fallbackSql = `SELECT u.PWD, u.EMAILID, u.USERID, u.FIRSTNAME, u.LASTNAME,
                                  u.STATUS, u.OTP, u.OTPUPDATEDT, u.FACILITYID, u.ROLEID,
                                  (CASE WHEN u.LOCKOUT_UNTIL IS NOT NULL AND u.LOCKOUT_UNTIL > SYSDATE THEN CEIL((u.LOCKOUT_UNTIL - SYSDATE) * 1440) ELSE 0 END) AS MINUTES_LOCKED,
                                  f.FOOTER1, f.FOOTER2, f.FOOTER3,
                                  r.ROLENAME,
                                  fac.FACILITYTYPEID,
                                  fac.FACILITYNAME
                           FROM USRUSERS u
                           LEFT JOIN MASFACHEADERFOOTER f ON f.USERID = TO_CHAR(u.USERID)
                           LEFT JOIN USRROLES r ON u.ROLEID = r.ROLEID
                           LEFT JOIN MASFACILITIES fac ON u.FACILITYID = fac.FACILITYID
                           WHERE TRIM(UPPER(u.EMAILID)) = TRIM(UPPER(:cleanEmail))
                           ORDER BY CASE WHEN u.STATUS = 'A' THEN 1 ELSE 2 END, u.USERID DESC`;

      const result = await db.execute(fallbackSql, { cleanEmail }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return result.rows || [];
    } catch (e) {
      return [];
    }
  }
}

/**
 * Find user by phone number (stored in MASFACHEADERFOOTER.FOOTER3) for login
 */
async function findByPhone(phoneNo) {
  const cleanPhone = String(phoneNo || '').trim();
  try {
    const sql = `SELECT u.PWD, u.EMAILID, u.USERID, u.FIRSTNAME, u.LASTNAME,
                        u.STATUS, u.OTP, u.OTPUPDATEDT, u.FACILITYID, u.ROLEID,
                        u.FAILED_ATTEMPTS, u.LOCKOUT_UNTIL,
                        (CASE WHEN u.LOCKOUT_UNTIL IS NOT NULL AND u.LOCKOUT_UNTIL > SYSDATE THEN CEIL((u.LOCKOUT_UNTIL - SYSDATE) * 1440) ELSE 0 END) AS MINUTES_LOCKED,
                        f.FOOTER1, f.FOOTER2, f.FOOTER3,
                        r.ROLENAME,
                        fac.FACILITYTYPEID,
                        ft.FACILITYTYPECODE,
                        ft.FACILITYTYPEDESC AS FACILITYTYPENAME,
                        fac.FACILITYNAME, ft.HODID
                 FROM USRUSERS u
                 LEFT JOIN MASFACHEADERFOOTER f ON f.USERID = TO_CHAR(u.USERID)
                 LEFT JOIN USRROLES r ON u.ROLEID = r.ROLEID
                 LEFT JOIN MASFACILITIES fac ON u.FACILITYID = fac.FACILITYID
                 LEFT JOIN MASFACILITYTYPES ft ON fac.FACILITYTYPEID = ft.FACILITYTYPEID
                 WHERE TRIM(f.FOOTER3) = :cleanPhone
                 ORDER BY CASE WHEN u.STATUS = 'A' THEN 1 ELSE 2 END, u.USERID DESC`;

    const result = await db.execute(sql, { cleanPhone }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows || [];
  } catch (err) {
    try {
      const fallbackSql = `SELECT u.PWD, u.EMAILID, u.USERID, u.FIRSTNAME, u.LASTNAME,
                                  u.STATUS, u.OTP, u.OTPUPDATEDT, u.FACILITYID, u.ROLEID,
                                  (CASE WHEN u.LOCKOUT_UNTIL IS NOT NULL AND u.LOCKOUT_UNTIL > SYSDATE THEN CEIL((u.LOCKOUT_UNTIL - SYSDATE) * 1440) ELSE 0 END) AS MINUTES_LOCKED,
                                  f.FOOTER1, f.FOOTER2, f.FOOTER3,
                                  r.ROLENAME,
                                  fac.FACILITYTYPEID,
                                  fac.FACILITYNAME
                           FROM USRUSERS u
                           LEFT JOIN MASFACHEADERFOOTER f ON f.USERID = TO_CHAR(u.USERID)
                           LEFT JOIN USRROLES r ON u.ROLEID = r.ROLEID
                           LEFT JOIN MASFACILITIES fac ON u.FACILITYID = fac.FACILITYID
                           WHERE TRIM(f.FOOTER3) = :cleanPhone
                           ORDER BY CASE WHEN u.STATUS = 'A' THEN 1 ELSE 2 END, u.USERID DESC`;

      const result = await db.execute(fallbackSql, { cleanPhone }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return result.rows || [];
    } catch (e) {
      return [];
    }
  }
}

/**
 * Find user by Email, Phone Number (FOOTER3 / DEPMOBILE), or User ID
 */
async function findByIdentifier(identifier) {
  const cleanId = String(identifier || '').trim();
  try {
    const sql = `SELECT u.PWD, u.EMAILID, u.USERID, u.FIRSTNAME, u.LASTNAME,
                        u.STATUS, u.OTP, u.OTPUPDATEDT, u.FACILITYID, u.ROLEID,
                        u.FAILED_ATTEMPTS, u.LOCKOUT_UNTIL,
                        (CASE WHEN u.LOCKOUT_UNTIL IS NOT NULL AND u.LOCKOUT_UNTIL > SYSDATE THEN CEIL((u.LOCKOUT_UNTIL - SYSDATE) * 1440) ELSE 0 END) AS MINUTES_LOCKED,
                        f.FOOTER1, f.FOOTER2, f.FOOTER3,
                        r.ROLENAME,
                        fac.FACILITYTYPEID,
                        ft.FACILITYTYPECODE,
                        ft.FACILITYTYPEDESC AS FACILITYTYPENAME,
                        fac.FACILITYNAME, ft.HODID
                 FROM USRUSERS u
                 LEFT JOIN MASFACHEADERFOOTER f ON f.USERID = TO_CHAR(u.USERID)
                 LEFT JOIN USRROLES r ON u.ROLEID = r.ROLEID
                 LEFT JOIN MASFACILITIES fac ON u.FACILITYID = fac.FACILITYID
                 LEFT JOIN MASFACILITYTYPES ft ON fac.FACILITYTYPEID = ft.FACILITYTYPEID
                 WHERE TRIM(UPPER(u.EMAILID)) = TRIM(UPPER(:cleanId))
                    OR TRIM(f.FOOTER3) = :cleanId
                    OR TO_CHAR(u.USERID) = :cleanId
                 ORDER BY CASE WHEN u.STATUS = 'A' THEN 1 ELSE 2 END, u.USERID DESC`;

    const result = await db.execute(sql, { cleanId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows || [];
  } catch (err) {
    try {
      const fallbackSql = `SELECT u.PWD, u.EMAILID, u.USERID, u.FIRSTNAME, u.LASTNAME,
                                  u.STATUS, u.OTP, u.OTPUPDATEDT, u.FACILITYID, u.ROLEID,
                                  (CASE WHEN u.LOCKOUT_UNTIL IS NOT NULL AND u.LOCKOUT_UNTIL > SYSDATE THEN CEIL((u.LOCKOUT_UNTIL - SYSDATE) * 1440) ELSE 0 END) AS MINUTES_LOCKED,
                                  f.FOOTER1, f.FOOTER2, f.FOOTER3,
                                  r.ROLENAME,
                                  fac.FACILITYTYPEID,
                                  fac.FACILITYNAME
                           FROM USRUSERS u
                           LEFT JOIN MASFACHEADERFOOTER f ON f.USERID = TO_CHAR(u.USERID)
                           LEFT JOIN USRROLES r ON u.ROLEID = r.ROLEID
                           LEFT JOIN MASFACILITIES fac ON u.FACILITYID = fac.FACILITYID
                           WHERE TRIM(UPPER(u.EMAILID)) = TRIM(UPPER(:cleanId))
                              OR TRIM(f.FOOTER3) = :cleanId
                              OR TO_CHAR(u.USERID) = :cleanId
                           ORDER BY CASE WHEN u.STATUS = 'A' THEN 1 ELSE 2 END, u.USERID DESC`;

      const result = await db.execute(fallbackSql, { cleanId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return result.rows || [];
    } catch (e) {
      return [];
    }
  }
}

/**
 * Direct lookup of FACILITYTYPEID and HODID from MASFACILITIES and MASFACILITYTYPES matching FACILITYID
 */
async function getFacilityDetails(facilityId) {
  if (!facilityId) return { facilityTypeId: null, hodId: null };
  try {
    const sql = `SELECT fac.FACILITYTYPEID, ft.HODID, ft.FACILITYTYPECODE, ft.FACILITYTYPEDESC 
                 FROM MASFACILITIES fac
                 LEFT JOIN MASFACILITYTYPES ft ON fac.FACILITYTYPEID = ft.FACILITYTYPEID
                 WHERE fac.FACILITYID = :facilityId`;
    const result = await db.execute(sql, { facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (result.rows && result.rows.length > 0) {
      const r = result.rows[0];
      return {
        facilityTypeId: r.FACILITYTYPEID || null,
        hodId: r.HODID !== undefined && r.HODID !== null ? Number(r.HODID) : null,
        facilityTypeCode: r.FACILITYTYPECODE || null,
        facilityTypeName: r.FACILITYTYPEDESC || null
      };
    }
    return { facilityTypeId: null, hodId: null };
  } catch (err) {
    try {
      const sql2 = `SELECT FACILITYTYPEID FROM MASFACILITIES WHERE FACILITYID = :facilityId`;
      const result2 = await db.execute(sql2, { facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return {
        facilityTypeId: result2.rows && result2.rows.length > 0 ? result2.rows[0].FACILITYTYPEID : null,
        hodId: null
      };
    } catch (e) {
      return { facilityTypeId: null, hodId: null };
    }
  }
}

/**
 * Direct lookup of FACILITYTYPEID from MASFACILITIES matching FACILITYID
 */
async function getFacilityTypeId(facilityId) {
  if (!facilityId) return null;
  try {
    const details = await getFacilityDetails(facilityId);
    return details.facilityTypeId;
  } catch (err) {
    return null;
  }
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
  try {
    const sql = `UPDATE USRUSERS 
                 SET OTP = :otp, 
                     OTPUPDATEDT = SYSDATE 
                 WHERE USERID = :userId`;
    await db.execute(sql, { otp, userId }, { autoCommit: true });
  } catch (err) {
    // Graceful fallback
  }
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
               LEFT JOIN MASFACHEADERFOOTER f ON f.USERID = TO_CHAR(u.USERID)
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
  try {
    const sql = `
      INSERT INTO GENAUDITLOGS (UserID, OPERATION, LOGDATE, IPAddress) 
      VALUES (:userId, :operation, SYSDATE, :ipAddress)
    `;
    await db.execute(sql, { userId, operation, ipAddress: ipAddress || '0.0.0.0' }, { autoCommit: true });
  } catch (err) {
    // Graceful fallback if GENAUDITLOGS table does not exist
  }
}

async function updateSessionId(userId, sessionId) {
  try {
    const sql = `UPDATE USRUSERS SET SESSION_ID = :sessionId WHERE USERID = :userId`;
    await db.execute(sql, { sessionId, userId }, { autoCommit: true });
  } catch (err) {
    // Graceful fallback if SESSION_ID column does not exist
  }
}

async function incrementFailedAttempts(userId) {
  try {
    const sql = `UPDATE USRUSERS SET FAILED_ATTEMPTS = NVL(FAILED_ATTEMPTS, 0) + 1 WHERE USERID = :userId`;
    await db.execute(sql, { userId }, { autoCommit: true });
  } catch (err) {
    // Graceful fallback
  }
}

async function lockAccount(userId, lockoutMinutes) {
  try {
    const sql = `UPDATE USRUSERS SET LOCKOUT_UNTIL = SYSDATE + (:lockoutMinutes / 1440) WHERE USERID = :userId`;
    await db.execute(sql, { lockoutMinutes, userId }, { autoCommit: true });
  } catch (err) {
    // Graceful fallback
  }
}

async function resetFailedAttempts(userId) {
  try {
    const sql = `UPDATE USRUSERS SET FAILED_ATTEMPTS = 0, LOCKOUT_UNTIL = NULL WHERE USERID = :userId`;
    await db.execute(sql, { userId }, { autoCommit: true });
  } catch (err) {
    // Graceful fallback
  }
}

async function getSessionId(userId) {
  try {
    const sql = `SELECT SESSION_ID FROM USRUSERS WHERE USERID = :userId`;
    const result = await db.execute(sql, { userId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows.length > 0 ? result.rows[0].SESSION_ID : null;
  } catch (err) {
    return null;
  }
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
  resetFailedAttempts,
  getFacilityTypeId,
  getFacilityDetails
};
