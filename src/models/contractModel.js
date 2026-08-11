const db = require('../config/db');

async function getContracts(facilityId, finYear) {
  const sql = `
    SELECT 
      Con.ContractID as "id",
      Coalesce(Sup.SupplierName, LPSup.SupplierName) as "supplier",
      Con.ContractNo as "contractNo",
      to_char(Con.ContractDate, 'dd-MM-yyyy') as "contractDate",
      to_char(t.tenderdate, 'dd-MM-yyyy') as "tenderDate",
      t.tenderno as "tenderNo",
      t.tenderdetails as "tenderDetails",
      CASE WHEN Con.Status = 'IN' THEN 'Incomplete' ELSE 'Awarded' END as "status"
    FROM LPContracts Con
    INNER JOIN usrusers psa ON psa.facilityid = Con.PSAID
    LEFT JOIN masSuppliers Sup ON Sup.SupplierID = Con.SupplierID
    LEFT JOIN LPmasSuppliers LPSup ON LPSup.LPSupplierID = Con.LPSupplierID
    LEFT JOIN LPMASTENDERS t ON t.tenderid = con.SchemeId
    LEFT JOIN masAccYearSettings yr ON yr.AccYrSetID = Con.AccYrSetID
    WHERE Con.IsDirectContract = 1 
      AND Con.PSAID = :facilityId
      AND Con.AccYrSetID = :finYear
    ORDER BY Psa.firstname, Con.ContractDate, Con.ContractNo
  `;
  const result = await db.execute(sql, { facilityId, finYear }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  
  return result.rows.map(r => ({
    id: r.id || r.ID,
    supplier: r.supplier || r.SUPPLIER,
    contractNo: r.contractNo || r.CONTRACTNO,
    contractDate: r.contractDate || r.CONTRACTDATE,
    tenderDate: r.tenderDate || r.TENDERDATE,
    tenderNo: r.tenderNo || r.TENDERNO,
    tenderDetails: r.tenderDetails || r.TENDERDETAILS,
    status: r.status || r.STATUS
  }));
}

async function getContractById(facilityId, id) {
  const sql = `
    SELECT 
      ContractID as "id",
      AccYrSetID as "finYear",
      LPSupplierID as "supplier",
      SchemeId as "tenderNo",
      ContractNo as "contractNo",
      to_char(ContractDate, 'yyyy-MM-dd') as "contractDate"
    FROM LPContracts
    WHERE ContractID = :id AND PSAID = :facilityId
  `;
  const result = await db.execute(sql, { id, facilityId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  if (result.rows.length === 0) return null;
  const r = result.rows[0];
  return {
    id: r.id || r.ID,
    finYear: (r.finYear || r.FINYEAR)?.toString(),
    supplier: (r.supplier || r.SUPPLIER)?.toString(),
    tenderNo: (r.tenderNo || r.TENDERNO)?.toString(),
    contractNo: (r.contractNo || r.CONTRACTNO)?.toString(),
    contractDate: r.contractDate || r.CONTRACTDATE
  };
}

async function getTenders(facilityId) {
  const sql = `
    SELECT DISTINCT 
      t.tenderno || ' ' || t.tenderdetails || ' ' || to_char(t.tenderdate, 'dd-MM-yyyy') as "tenderName",
      t.tenderid as "tenderId"
    FROM LPMASTENDERS t
    INNER JOIN masaccyearsettings a ON a.accyrsetid = t.accyrsetid
    WHERE t.Facilityid = :facilityId
  `;
  const result = await db.execute(sql, { facilityId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  
  return result.rows.map(r => ({
    id: r.tenderId || r.TENDERID,
    name: r.tenderName || r.TENDERNAME
  }));
}

async function getFinYears() {
  const sql = `SELECT accyrsetid, accyear FROM masaccyearsettings WHERE accyrsetid > 541 ORDER BY accyrsetid DESC`;
  const result = await db.execute(sql, {}, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows.map(r => ({
    id: r.ACCYRSETID || r.accyrsetid,
    name: r.ACCYEAR || r.accyear
  }));
}

let localItemsCache = null;
let localItemsCacheTime = null;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

async function getLocalItems(finYearId) {
  if (localItemsCache && localItemsCacheTime && (Date.now() - localItemsCacheTime < CACHE_TTL)) {
    return localItemsCache;
  }

  const sql = `
    SELECT
      i.ITEMID as "lpItemId",
      i.ITEMCODE as "itemCode",
      i.ITEMNAME as "itemName",
      i.STRENGTH1 as "strength",
      i.UNIT as "unit",
      i.PACKINGQTY as "packQty",
      i.ISEDL as "isEdl",
      i.CATEGORYID as "categoryId",
      c.MCID as "mcId",
      mc.MCATEGORY as "mCategory"
    FROM VMASITEMS i
    INNER JOIN MASITEMCATEGORIES c
      ON c.CATEGORYID = i.CATEGORYID
    INNER JOIN MASITEMMAINCATEGORY mc
      ON mc.MCID = c.MCID
    ORDER BY mc.MCATEGORY, i.ITEMNAME
  `;
  const result = await db.execute(sql, {}, { outFormat: 4002, fetchArraySize: 10000 });
  const data = result.rows.map(r => ({
    id: r.lpItemId || r.LPITEMID || r.ITEMID,
    itemCode: r.itemCode || r.ITEMCODE,
    name: r.itemName || r.ITEMNAME,
    strength: r.strength || r.STRENGTH1,
    unit: r.unit || r.UNIT,
    packQty: r.packQty || r.PACKINGQTY,
    isEdl: r.isEdl || r.ISEDL,
    categoryId: r.categoryId || r.CATEGORYID,
    mcId: r.mcId || r.MCID,
    mCategory: r.mCategory || r.MCATEGORY
  }));
  
  localItemsCache = data;
  localItemsCacheTime = Date.now();
  return data;
}

async function getTendersList(facilityId, finYearId) {
  const sql = `
    SELECT 
      t.tenderid as "id",
      t.tenderno as "tenderNo",
      t.tenderdetails as "tenderDetails",
      to_char(t.tenderdate, 'YYYY-MM-DD') as "tenderDate",
      t.accyrsetid as "accyrsetid",
      a.accyear as "accyear",
      t.TermCondition as "termCondition"
    FROM LPMASTENDERS t
    INNER JOIN masaccyearsettings a ON a.accyrsetid = t.accyrsetid
    WHERE t.accyrsetid = :finYearId AND t.Facilityid = :facilityId
  `;
  const result = await db.execute(sql, { facilityId, finYearId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows.map(r => ({
    id: r.id || r.ID,
    tenderNo: r.tenderNo || r.TENDERNO,
    tenderDetails: r.tenderDetails || r.TENDERDETAILS,
    tenderDate: r.tenderDate || r.TENDERDATE,
    accyrsetid: r.accyrsetid || r.ACCYRSETID,
    accyear: r.accyear || r.ACCYEAR,
    termCondition: r.termCondition || r.TERMCONDITION
  }));
}

async function createTender(facilityId, data) {
  const sql = `
    INSERT INTO LPMASTENDERS (
      Facilityid, tenderno, tenderdetails, tenderdate, entrydate, accyrsetid, TermCondition
    ) VALUES (
      :facilityId, :tenderNo, :tenderDetails, TO_DATE(:tenderDate, 'YYYY-MM-DD'), sysdate, :accyrsetid, :termCondition
    )
  `;
  await db.execute(sql, {
    facilityId,
    tenderNo: data.tenderNo,
    tenderDetails: data.tenderDetails,
    tenderDate: data.tenderDate,
    accyrsetid: data.accyrsetid,
    termCondition: data.termCondition || null
  }, { autoCommit: true });
}

async function updateTender(tenderId, data) {
  const sql = `
    UPDATE LPMASTENDERS SET 
      tenderno = :tenderNo,
      tenderdetails = :tenderDetails,
      tenderdate = TO_DATE(:tenderDate, 'YYYY-MM-DD'),
      accyrsetid = :accyrsetid,
      TermCondition = :termCondition
    WHERE tenderid = :tenderId
  `;
  await db.execute(sql, {
    tenderId,
    tenderNo: data.tenderNo,
    tenderDetails: data.tenderDetails,
    tenderDate: data.tenderDate,
    accyrsetid: data.accyrsetid,
    termCondition: data.termCondition || null
  }, { autoCommit: true });
}

async function deleteTender(tenderId) {
  const sql = `DELETE FROM LPMASTENDERS WHERE tenderid = :tenderId`;
  await db.execute(sql, { tenderId }, { autoCommit: true });
}

async function getContractsForSO(accyrsetid, lpsupplierid, psaid) {
  const sql = `
    SELECT 
      contractid as "id", 
      'Contract No : ' || contractno || '- Contract Date : ' || to_char(contractdate, 'dd-MM-yyyy') as "name" 
    FROM lpcontracts 
    WHERE accyrsetid = :accyrsetid 
      AND lpsupplierid = :lpsupplierid 
      AND psaid = :psaid
  `;
  const binds = {
    accyrsetid: parseInt(accyrsetid, 10),
    lpsupplierid: parseInt(lpsupplierid, 10),
    psaid: parseInt(psaid, 10)
  };
  const result = await db.execute(sql, binds, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows.map(r => ({
    id: r.id || r.ID,
    name: r.name || r.NAME
  }));
}

async function createContract(facilityId, data) {
  const sql = `
    INSERT INTO LPContracts (
      AccYrSetID, SourceID, SchemeID, ContractNO, ContractDate, PSAID, LPSupplierID, Status, IsDirectContract
    ) VALUES (
      :accYrSetId, null, :schemeId, :contractNo, TO_DATE(:contractDate, 'YYYY-MM-DD'), :facilityId, :lpSupplierId, 'IN', 1
    )
  `;
  await db.execute(sql, {
    accYrSetId: parseInt(data.finYear, 10),
    schemeId: parseInt(data.tenderNo, 10),
    contractNo: data.contractNo,
    contractDate: data.contractDate,
    facilityId: parseInt(facilityId, 10),
    lpSupplierId: parseInt(data.supplier, 10)
  }, { autoCommit: true });

  const getSql = `
    SELECT ContractID FROM LPContracts 
    WHERE ContractNO = :contractNo 
      AND PSAID = :facilityId
    ORDER BY ContractID DESC
  `;
  const getRes = await db.execute(getSql, {
    contractNo: data.contractNo,
    facilityId: parseInt(facilityId, 10)
  }, { outFormat: 4002 });
  
  if (getRes.rows && getRes.rows.length > 0) {
    const cid = getRes.rows[0].CONTRACTID || getRes.rows[0].contractid;
    console.log("createContract returned ContractID:", cid);
    return cid;
  }
  console.log("createContract returned null. getRes.rows:", getRes.rows);
  return null;
}

async function updateContract(contractId, facilityId, data) {
  const sql = `
    UPDATE LPContracts SET 
      AccYrSetID = :accYrSetId,
      ContractNO = :contractNo,
      ContractDate = TO_DATE(:contractDate, 'YYYY-MM-DD'),
      LPSupplierID = :lpSupplierId,
      SchemeID = :schemeId
    WHERE ContractID = :contractId AND PSAID = :facilityId
  `;
  await db.execute(sql, {
    accYrSetId: parseInt(data.finYear, 10),
    contractNo: data.contractNo,
    contractDate: data.contractDate,
    lpSupplierId: parseInt(data.supplier, 10),
    schemeId: parseInt(data.tenderNo, 10),
    contractId: parseInt(contractId, 10),
    facilityId: parseInt(facilityId, 10)
  }, { autoCommit: true });
}

async function getContractItems(contractId) {
  const sql = `
    SELECT 
      c.CONTRACTITEMID as "id",
      c.ITEMID as "itemId",
      c.LPITEMID as "lpItemId",
      m.ITEMCODE as "itemCode",
      m.ITEMNAME as "itemName",
      c.SINGLEUNITPRICE as "unitPrice",
      c.CONTRACTABSQTY as "qty",
      c.ITEMVALUE as "itemValue",
      c.MANUFACTURER as "manufacturer",
      c.PERCENTVALUEGST as "gst",
      c.BASICRATE as "basicRate"
    FROM LPContractItems c
    LEFT JOIN VMASITEMS m ON c.LPITEMID = m.ITEMID
    WHERE c.ContractID = :contractId
  `;
  const result = await db.execute(sql, { contractId: parseInt(contractId, 10) }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows.map(r => ({
    id: r.id || r.ID,
    itemId: r.itemId || r.ITEMID,
    lpItemId: r.lpItemId || r.LPITEMID,
    itemCode: r.itemCode || r.ITEMCODE,
    itemName: r.itemName || r.ITEMNAME,
    unitPrice: r.unitPrice || r.SINGLEUNITPRICE,
    qty: r.qty || r.CONTRACTABSQTY,
    itemValue: r.itemValue || r.ITEMVALUE,
    manufacturer: r.manufacturer || r.MANUFACTURER,
    gst: r.gst || r.PERCENTVALUEGST,
    basicRate: r.basicRate || r.BASICRATE
  }));
}

async function addContractItem(contractId, data) {
  const sql = `
    INSERT INTO LPContractItems (
      ContractID, LPItemID, SingleUnitPrice, ContractAbsQty, ItemValue, IsActive,
      Manufacturer, PercentValueGST, BasicRate
    ) VALUES (
      :contractId, :lpItemId, :unitPrice, :qty, :itemValue, 1,
      :manufacturer, :gst, :basicRate
    )
  `;
  const itemValue = (parseFloat(data.unitPrice) * parseFloat(data.qty)).toFixed(2);
  
  await db.execute(sql, {
    contractId: parseInt(contractId, 10),
    lpItemId: parseInt(data.lpItemId, 10),
    unitPrice: parseFloat(data.unitPrice),
    qty: parseFloat(data.qty),
    itemValue: parseFloat(itemValue),
    manufacturer: data.manufacturer || null,
    gst: data.gst ? parseFloat(data.gst) : null,
    basicRate: data.basicRate ? parseFloat(data.basicRate) : null
  }, { autoCommit: true });
}

async function deleteContractItem(contractItemId) {
  const sql = `DELETE FROM LPContractItems WHERE CONTRACTITEMID = :contractItemId`;
  await db.execute(sql, { contractItemId: parseInt(contractItemId, 10) }, { autoCommit: true });
}

async function completeContract(contractId, facilityId) {
  const sql = `
    UPDATE LPContracts SET Status = 'C'
    WHERE ContractID = :contractId AND PSAID = :facilityId
  `;
  await db.execute(sql, { 
    contractId: parseInt(contractId, 10), 
    facilityId: parseInt(facilityId, 10) 
  }, { autoCommit: true });
}

module.exports = {
  getContracts,
  getTenders,
  getFinYears,
  getTendersList,
  createTender,
  updateTender,
  deleteTender,
  getContractById,
  getContractsForSO,
  createContract,
  updateContract,
  completeContract,
  getContractItems,
  addContractItem,
  deleteContractItem,
  getLocalItems
};
