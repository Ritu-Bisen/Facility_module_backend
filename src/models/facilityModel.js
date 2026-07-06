const db = require('../config/db');
const oracledb = require('oracledb');

async function getItems(facilityId) {
  const query = `
    SELECT
      mi.itemid,
      (mi.itemcode || '-' || mi.itemname || '-' || mi.strength1) AS displayname
    FROM tbfacilityreceiptbatches rb
    INNER JOIN tbfacilityreceiptitems i
      ON rb.facreceiptitemid = i.facreceiptitemid
    INNER JOIN masitems mi
      ON mi.itemid = i.itemid
    INNER JOIN tbfacilityreceipts r
      ON r.facreceiptid = i.facreceiptid
    WHERE r.facilityid = :facilityId
    GROUP BY
      mi.itemid,
      mi.itemcode,
      mi.itemname,
      mi.strength1
    ORDER BY mi.itemname
  `;

  const result = await db.execute(query, { facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  
  return result.rows.map(row => ({
    itemid: row.ITEMID,
    displayname: row.DISPLAYNAME
  }));
}

module.exports = {
  getItems
};
