const db = require('../config/db');
const oracledb = require('oracledb');

async function getCategories() {
  const query = `SELECT categoryid, categoryname FROM masitemcategories ORDER BY categoryname`;
  const result = await db.execute(query, {}, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows.map(row => ({
    id: row.CATEGORYID || row.categoryid,
    name: row.CATEGORYNAME || row.categoryname
  }));
}

async function getItemTypes() {
  const query = `SELECT itemtypeid, itemtypename FROM masitemtypes ORDER BY itemtypename`;
  const result = await db.execute(query, {}, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows.map(row => ({
    id: row.ITEMTYPEID || row.itemtypeid,
    name: row.ITEMTYPENAME || row.itemtypename
  }));
}

async function getEdlItems() {
  const query = `select itemcode, itemname||'-'||unit||'-'||itemcode as name from masitems where activeflag='Y'`;
  const result = await db.execute(query, {}, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows.map(row => ({
    itemCode: row.ITEMCODE || row.itemcode,
    name: row.NAME || row.name
  }));
}

async function getEdlItemDetails(itemCode) {
  const query = `
    select itemcode, itemname, unit, categoryid, groupid, itemtypeid, strength1, 
           nvl(packingqty,'0') as pck, unitcount, multiple 
    from masitems 
    where itemcode = :itemCode
  `;
  const result = await db.execute(query, { itemCode }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    itemCode: row.ITEMCODE || row.itemcode,
    itemName: row.ITEMNAME || row.itemname,
    unit: row.UNIT || row.unit,
    categoryId: row.CATEGORYID || row.categoryid,
    itemTypeId: row.ITEMTYPEID || row.itemtypeid,
    strength: row.STRENGTH1 || row.strength1,
    packQty: row.PCK || row.pck,
    unitCount: row.UNITCOUNT || row.unitcount,
    multiple: row.MULTIPLE || row.multiple
  };
}

async function getLocalItems(categoryId) {
  let query = `
    Select LPI.LPItemID, LPI.ItemCode, LPI.ItemName as Description, LPI.Strength, LPI.Unit as SKU,
           LPI.PackingQty, Cat.CategoryName, LPI.CategoryID, LPI.ItemID, IT.ItemTypeName, LPI.unitcount, LPI.multiple,
           LPI.EDLitemcode, LPI.ItemTypeID,
           (select case count(*) when 0 then 'True' else 'False' end
            from lpsoorderplaced LPOP
            inner join lpsoordereditems LPOI on LPOI.PoNoID = LPOP.PoNoID
            where LPI.LPItemID = LPOI.LPItemID) as Deletable
    from LPMasItems LPI
    Left Outer Join MasItemCategories Cat on Cat.CategoryID = LPI.CategoryID
    Left Outer Join MasItemTypes IT on IT.ItemTypeID = LPI.ItemTypeID
  `;
  const binds = {};

  if (categoryId && categoryId !== 'null' && categoryId !== 'undefined' && categoryId !== '') {
    query += ` where LPI.CategoryID = :categoryId `;
    binds.categoryId = categoryId;
  }
  
  query += ` Order By LPI.ItemCode`;

  const result = await db.execute(query, binds, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows.map(row => ({
    lpItemId: row.LPITEMID || row.lpitemid,
    itemCode: row.ITEMCODE || row.itemcode,
    description: row.DESCRIPTION || row.description,
    strength: row.STRENGTH || row.strength,
    sku: row.SKU || row.sku,
    packSize: row.PACKINGQTY || row.packingqty,
    categoryName: row.CATEGORYNAME || row.categoryname,
    categoryId: row.CATEGORYID || row.categoryid,
    itemTypeName: row.ITEMTYPENAME || row.itemtypename,
    itemTypeId: row.ITEMTYPEID || row.itemtypeid,
    unitCount: row.UNITCOUNT || row.unitcount,
    multiple: row.MULTIPLE || row.multiple,
    deletable: (row.DELETABLE || row.deletable) === 'True',
    edlItemCode: row.EDLITEMCODE || row.edlitemcode
  }));
}

async function generateNextLpCode() {
  const query = `select max(substr(itemcode,3,6)) as idt from lpmasitems where edlitemcode is null`;
  const result = await db.execute(query, {}, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  let idt = result.rows.length > 0 ? (result.rows[0].IDT || result.rows[0].idt) : null;
  if (!idt) {
    return 'LP0001';
  } else {
    let nextId = parseInt(idt, 10) + 1;
    return 'LP' + nextId.toString().padStart(4, '0');
  }
}

async function checkItemUsed(lpItemId) {
  const query1 = `select count(lpitemid) as c from lpcontractitems where lpitemid = :lpItemId`;
  const query2 = `select count(itemid) as c from tbfacilityreceiptitems where itemid = :lpItemId`;
  
  const res1 = await db.execute(query1, { lpItemId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  const res2 = await db.execute(query2, { lpItemId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  
  const count1 = res1.rows[0].C || res1.rows[0].c;
  const count2 = res2.rows[0].C || res2.rows[0].c;
  
  return (count1 > 0 || count2 > 0);
}

async function checkDuplicate(itemCode, itemName, strength, lpItemId, facilityId) {
  let query = `
    select lpitemid from LPMasItems 
    where PsaID = :facilityId 
    and (ItemCode = :itemCode OR (ItemName = :itemName AND Strength = :strength))
  `;
  const binds = { facilityId, itemCode, itemName, strength: strength || '' };
  if (lpItemId) {
    query += ` and LPItemID != :lpItemId`;
    binds.lpItemId = lpItemId;
  }
  
  const result = await db.execute(query, binds, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows.length > 0;
}

async function createLocalItem(data, facilityId) {
  const query = `
    Insert into LPMasItems (ItemCode,ItemName,Strength,Unit,PackingQty,CategoryID,PsaID,ItemTypeID,EDLitemcode,unitcount,multiple)
    values (:ItemCode, :ItemName, :Strength, :Unit, :PackingQty, :CategoryID, :PsaID, :ItemTypeID, :EDLitemcode, :unitcount, :multiple)
  `;
  const binds = {
    ItemCode: data.itemCode,
    ItemName: data.itemName,
    Strength: data.strength || '',
    Unit: data.sku || '',
    PackingQty: data.packQty || 0,
    CategoryID: data.categoryId || null,
    PsaID: facilityId,
    ItemTypeID: data.itemTypeId || null,
    EDLitemcode: data.edlItemCode || null,
    unitcount: data.unitCount || 1,
    multiple: data.multiple || 1
  };
  
  await db.execute(query, binds, { autoCommit: true });
}

async function updateLocalItem(data) {
  const query = `
    Update LPMasItems set 
      ItemCode=:ItemCode, 
      ItemName=:ItemName, 
      Strength=:Strength, 
      Unit=:Unit, 
      EDLitemcode=:EDLitemcode, 
      PackingQty=:PackingQty, 
      CategoryID=:CategoryID, 
      ItemTypeID=:ItemTypeID, 
      unitcount=:unitcount, 
      multiple=:multiple 
    Where LPItemID=:LPItemID
  `;
  const binds = {
    ItemCode: data.itemCode,
    ItemName: data.itemName,
    Strength: data.strength || '',
    Unit: data.sku || '',
    EDLitemcode: data.edlItemCode || null,
    PackingQty: data.packQty || 0,
    CategoryID: data.categoryId || null,
    ItemTypeID: data.itemTypeId || null,
    unitcount: data.unitCount || 1,
    multiple: data.multiple || 1,
    LPItemID: data.lpItemId
  };
  
  await db.execute(query, binds, { autoCommit: true });
}

async function deleteLocalItem(lpItemId) {
  const query = `Delete LPMasItems Where LPItemID = :lpItemId`;
  await db.execute(query, { lpItemId }, { autoCommit: true });
}

module.exports = {
  getCategories,
  getItemTypes,
  getEdlItems,
  getEdlItemDetails,
  getLocalItems,
  generateNextLpCode,
  checkItemUsed,
  checkDuplicate,
  createLocalItem,
  updateLocalItem,
  deleteLocalItem
};
