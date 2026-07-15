const db = require('../config/db');
const oracledb = require('oracledb');

async function getFacilityInfo(userId) {
  const query = `
    SELECT USERID, HEADER1, HEADER2, HEADER3, FOOTER1, FOOTER2, FOOTER3, drmobile, drName, EMAIL
    FROM MASFACHEADERFOOTER
    WHERE USERID = :userId
  `;
  const result = await db.execute(query, { userId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows.length > 0 ? result.rows[0] : null;
}

async function saveFacilityInfo(userId, data) {
  const { header1, header2, header3, footer1, footer2, footer3, drMobile, drName, email } = data;
  
  // Check if exists
  const checkQuery = `SELECT count(USERID) as CNT FROM MASFACHEADERFOOTER WHERE USERID = :userId`;
  const checkResult = await db.execute(checkQuery, { userId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  const exists = checkResult.rows[0].CNT > 0;

  if (exists) {
    const updateQuery = `
      UPDATE MASFACHEADERFOOTER 
      SET HEADER1 = :header1, HEADER2 = :header2, HEADER3 = :header3, 
          FOOTER1 = :footer1, FOOTER2 = :footer2, FOOTER3 = :footer3, 
          drmobile = :drMobile, drName = :drName, EMAIL = :email
      WHERE USERID = :userId
    `;
    await db.execute(updateQuery, {
      header1, header2, header3, footer1, footer2, footer3, drMobile, drName, email, userId
    }, { autoCommit: true });
  } else {
    const insertQuery = `
      INSERT INTO MASFACHEADERFOOTER 
      (USERID, HEADER1, HEADER2, HEADER3, FOOTER1, FOOTER2, FOOTER3, drName, drmobile, EMAIL)
      VALUES 
      (:userId, :header1, :header2, :header3, :footer1, :footer2, :footer3, :drName, :drMobile, :email)
    `;
    await db.execute(insertQuery, {
      userId, header1, header2, header3, footer1, footer2, footer3, drName, drMobile, email
    }, { autoCommit: true });
  }

  // Also update usrUsers
  const updateUsersQuery = `
    UPDATE usrUsers 
    SET depemail = :email, depmobile = :footer3, LASTPWDCHANGEDATE = sysdate
    WHERE userid = :userId
  `;
  await db.execute(updateUsersQuery, {
    email, footer3, userId
  }, { autoCommit: true });

  return true;
}

module.exports = {
  getFacilityInfo,
  saveFacilityInfo
};
