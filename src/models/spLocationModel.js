const db = require('../config/db');
const oracledb = require('oracledb');

const spLocationModel = {
  getLocations: async (facilityId, page = 1, limit = 20, searchId = null) => {
    const offset = (page - 1) * limit;
    let query = `
      SELECT m.ID, m.NAME as locationno, f.facilityname, m.facilityid
      FROM massplocation m
      INNER JOIN masfacilities f ON f.facilityid = m.facilityid
      WHERE m.facilityid = :facilityId
    `;
    const binds = { facilityId };

    if (searchId) {
      query += ` AND m.ID = :searchId `;
      binds.searchId = searchId;
    }

    query += `
      ORDER BY m.ID
      OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
    `;
    
    binds.offset = offset;
    binds.limit = limit;

    const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows.map(row => ({
      ID: row.ID,
      locationno: row.LOCATIONNO,
      facilityname: row.FACILITYNAME,
      facilityid: row.FACILITYID
    }));
  },

  addLocation: async (facilityId, locationNo) => {
    const query = `
      INSERT INTO massplocation (NAME, Facilityid)
      VALUES (:locationNo, :facilityId)
    `;
    const binds = { locationNo, facilityId };
    const result = await db.execute(query, binds, { autoCommit: true });
    return result;
  },

  updateLocation: async (id, locationNo) => {
    const query = `
      UPDATE massplocation 
      SET NAME = :locationNo
      WHERE ID = :id
    `;
    const binds = { locationNo, id };
    const result = await db.execute(query, binds, { autoCommit: true });
    return result;
  },

  deleteLocation: async (id) => {
    const query = `DELETE FROM massplocation WHERE ID = :id`;
    const result = await db.execute(query, { id }, { autoCommit: true });
    return result;
  }
};

module.exports = spLocationModel;
