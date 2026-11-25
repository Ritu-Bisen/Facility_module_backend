const db = require('../config/db');
const oracledb = require('oracledb');

async function getItemDetails(itemId) {
  const query = `
    SELECT
      mi.itemid,
      mi.itemcode,
      mi.itemname,
      mi.strength1,
      mi.unit,
      mit.itemtypecode AS type,
      mi.packingqty,
      mi.isedl2019
    FROM vmasitems mi
    LEFT JOIN masitemtypes mit
      ON mit.itemtypeid = mi.itemtypeid
    WHERE TO_CHAR(mi.itemid) = :itemId OR mi.itemcode = :itemId
  `;

  const result = await db.execute(query, { itemId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  
  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    itemid: row.ITEMID || row.itemid,
    itemcode: row.ITEMCODE || row.itemcode,
    itemname: row.ITEMNAME || row.itemname,
    strength1: row.STRENGTH1 || row.strength1,
    sku: row.UNIT || row.unit,
   
    type: row.TYPE || row.type,
 
    packqty: row.PACKINGQTY || row.packingqty,
    isedl2019: row.ISEDL2019 || row.isedl2019,
    edltype: row.ISEDL2019 || row.isedl2019
  };
}

async function getDrugs() {
  const query = `
    SELECT itemid, itemcode, itemname
    FROM vmasitems
    ORDER BY itemname
  `;

  const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows.map(row => ({
    itemid: row.ITEMID || row.itemid,
    itemcode: row.ITEMCODE || row.itemcode,
    itemname: row.ITEMNAME || row.itemname
  }));
}

async function getItemTypes() {
  const query = `
    SELECT itemtypeid, itemtypename 
    FROM masitemtypes
    ORDER BY itemtypename
  `;
  const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows.map(row => ({
    itemTypeId: row.ITEMTYPEID,
    itemTypeName: row.ITEMTYPENAME
  }));
}

module.exports = {
  getItemDetails,
  getDrugs,
  getItemTypes
};
