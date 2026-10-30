const db = require('../config/db');
const oracledb = require('oracledb');

async function getItems(facilityId, inStockOnly = false) {
  let query;
  if (inStockOnly) {
    query = `
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
      LEFT OUTER JOIN (
        SELECT
          fs.facilityid,
          fsi.itemid,
          ftbo.inwno,
          SUM(NVL(ftbo.issueqty, 0)) AS issueqty
        FROM tbfacilityissues fs
        INNER JOIN tbfacilityissueitems fsi
          ON fsi.issueid = fs.issueid
        INNER JOIN tbfacilityoutwards ftbo
          ON ftbo.issueitemid = fsi.issueitemid
        WHERE fs.status = 'C'
        GROUP BY fsi.itemid, fs.facilityid, ftbo.inwno
      ) iq ON rb.inwno = iq.inwno AND iq.itemid = i.itemid AND iq.facilityid = r.facilityid
      WHERE r.facilityid = :facilityId
        AND r.status = 'C'
        AND rb.qastatus = '1'
        AND (rb.Whissueblock = 0 OR rb.Whissueblock IS NULL)
        AND (rb.expdate >= SYSDATE OR NVL(rb.expdate, SYSDATE) >= SYSDATE)
      GROUP BY
        mi.itemid,
        mi.itemcode,
        mi.itemname,
        mi.strength1
      HAVING SUM(NVL(rb.absrqty, 0) - NVL(iq.issueqty, 0)) > 0
      ORDER BY mi.itemname
    `;
  } else {
    query = `
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
  }

  const result = await db.execute(query, { facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  
  return result.rows.map(row => ({
    itemid: row.ITEMID,
    displayname: row.DISPLAYNAME
  }));
}

module.exports = {
  getItems
};
