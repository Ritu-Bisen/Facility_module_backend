const db = require('../config/db');
const oracledb = require('oracledb');

async function getWards(facilityId, page = 1, limit = 20, searchId = null) {
  const offset = (page - 1) * limit;
  let query = `
    SELECT WardID, WardCode, WardName, ISVISIBLE
    FROM MasFacilityWards
    WHERE FacilityID = :facilityId
  `;
  const binds = { facilityId };

  if (searchId) {
    query += ` AND WardID = :searchId `;
    binds.searchId = searchId;
  }

  query += `
    ORDER BY WardCode
    OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
  `;
  
  binds.offset = offset;
  binds.limit = limit;

  const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows.map(row => ({
    WardID: row.WARDID,
    WardCode: row.WARDCODE,
    WardName: row.WARDNAME,
    IsOPDEntry: row.ISVISIBLE === 'Y' ? 'YES' : 'NO'
  }));
}

async function addWard(facilityId, wardCode, wardName, isOpdEntry, pwdString) {
  const isVisible = isOpdEntry ? 'Y' : 'N';
  const query = `
    INSERT INTO MasFacilityWards (FacilityID, WardCode, WardName, ISVISIBLE, PWD)
    VALUES (:facilityId, :wardCode, :wardName, :isVisible, :pwdString)
  `;
  const binds = { facilityId, wardCode, wardName, isVisible, pwdString };
  const result = await db.execute(query, binds, { autoCommit: true });
  return result;
}

async function updateWard(wardId, wardCode, wardName, isOpdEntry, pwdString) {
  const isVisible = isOpdEntry ? 'Y' : 'N';
  
  let query;
  let binds = { wardCode, wardName, isVisible, wardId };

  if (pwdString) {
    query = `
      UPDATE MasFacilityWards
      SET WardCode = :wardCode, WardName = :wardName, ISVISIBLE = :isVisible, PWD = :pwdString
      WHERE WardID = :wardId
    `;
    binds.pwdString = pwdString;
  } else {
    query = `
      UPDATE MasFacilityWards
      SET WardCode = :wardCode, WardName = :wardName, ISVISIBLE = :isVisible
      WHERE WardID = :wardId
    `;
  }
  
  const result = await db.execute(query, binds, { autoCommit: true });
  return result;
}

async function deleteWard(wardId) {
  const query = `
    DELETE FROM MasFacilityWards
    WHERE WardID = :wardId
  `;
  const result = await db.execute(query, { wardId }, { autoCommit: true });
  return result;
}

module.exports = {
  getWards,
  addWard,
  updateWard,
  deleteWard
};
