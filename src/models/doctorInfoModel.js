const db = require('../config/db');
const oracledb = require('oracledb');

const doctorInfoModel = {
  getDoctors: async (facilityId, page = 1, limit = 20, searchId = null) => {
    const offset = (page - 1) * limit;
    let query = `
      SELECT DRID, DRNAME, mobileno, facilityid, wardid
      FROM MasDocter
      WHERE facilityid = :facilityId
    `;
    const binds = { facilityId };

    if (searchId) {
      query += ` AND DRID = :searchId `;
      binds.searchId = searchId;
    }

    query += `
      ORDER BY DRID
      OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
    `;
    
    binds.offset = offset;
    binds.limit = limit;

    const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows.map(row => ({
      DRID: row.DRID,
      DRNAME: row.DRNAME,
      mobileno: row.MOBILENO,
      facilityid: row.FACILITYID,
      wardid: row.WARDID
    }));
  },

  addDoctor: async (facilityId, drName, mobileNo) => {
    const query = `
      INSERT INTO MasDocter (
        DRNAME, facilityid, wardid, inserteddate, insertedby, machineip, syncstatus, isactive, mobileno
      ) VALUES (
        :drName, :facilityId, :facilityId, SYSDATE, :facilityId, 'HCL-PC', 'N', 1, :mobileNo
      )
    `;
    const binds = { drName, facilityId, mobileNo };
    const result = await db.execute(query, binds, { autoCommit: true });
    return result;
  },

  updateDoctor: async (drId, drName, mobileNo, facilityId) => {
    const query = `
      UPDATE MasDocter 
      SET DRNAME = :drName, mobileno = :mobileNo, updateddate = SYSDATE, updatedby = :facilityId
      WHERE DRID = :drId
    `;
    const binds = { drName, mobileNo, facilityId, drId };
    const result = await db.execute(query, binds, { autoCommit: true });
    return result;
  },

  deleteDoctor: async (drId) => {
    const query = `DELETE FROM MasDocter WHERE DRID = :drId`;
    const result = await db.execute(query, { drId }, { autoCommit: true });
    return result;
  }
};

module.exports = doctorInfoModel;
