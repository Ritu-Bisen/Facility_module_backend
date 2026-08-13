const db = require('../config/db');
const oracledb = require('oracledb');

async function getReturnToWarehouseList(facilityId, finYearId, statusId) {
  let statusCondition = '';
  if (statusId === 'IR') {
    statusCondition = "AND (NVL(a.Status, 'IN') = 'IN' OR NVL(a.returnStatus, 0) = 0)";
  } else if (statusId === 'CR') {
    statusCondition = "AND (NVL(a.Status, 'IN') = 'C' OR NVL(a.returnStatus, 0) = 1)";
  }

  const sql = `
    SELECT 
      a.warehouseid as "warehouseId",
      b.warehousename as "warehouseName",
      c.StateName as "stateName",
      fac.FacilityName as "facilityName",
      d.DistrictName as "districtName",
      a.IssueNo as "issueNo",
      a.IssueDate as "issueDate",
      a.WRequestBy as "wRequestBy",
      a.Status as "status",
      a.returnStatus as "returnStatus",
      a.IssueID as "issueId"
    FROM tbFacilityIssues a 
    INNER JOIN masFacilities fac ON (fac.FacilityID = a.FacilityID) 
    INNER JOIN maswarehouses b ON (b.warehouseid = a.warehouseid) 
    LEFT JOIN masStates c ON (c.StateID = fac.StateID) 
    LEFT JOIN masDistricts d ON (d.StateID = c.StateID AND d.DistrictID = fac.DistrictID) 
    INNER JOIN masAccYearSettings m1 ON (a.IssueDate BETWEEN m1.StartDate AND m1.EndDate)  
    WHERE a.FacilityID = :facilityId 
      AND m1.AccYrSetID = :finYearId
      AND a.IssueType = 'RF'
      ${statusCondition}
    ORDER BY a.IssueDate DESC, a.IssueID DESC
  `;

  try {
    const result = await db.execute(sql, { facilityId, finYearId }, { outFormat: oracledb.OUT_FORMAT_OBJECT || 4002 });
    return result.rows || [];
  } catch (error) {
    console.error("Error in getReturnToWarehouseList:", error);
    return [];
  }
}

async function getWarehouses(facilityId) {
  const sql = `
    SELECT mw.warehouseid AS "WAREHOUSEID", mw.warehousename AS "WAREHOUSENAME"
    FROM masfacilitywh mf
    INNER JOIN MASWAREHOUSES mw ON mf.warehouseid = mw.warehouseid
    WHERE mf.facilityid = :facilityId
    ORDER BY mw.warehousename
  `;
  try {
    const result = await db.execute(sql, { facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT || 4002 });
    return result.rows || [];
  } catch (error) {
    console.error("Error fetching warehouses:", error);
    return [];
  }
}

async function generateIssueNo(facilityId) {
  // Step 1: Get Facility Code
  const facSql = "SELECT FacilityCode FROM masFacilities WHERE FacilityID = :facilityId";
  const facRes = await db.execute(facSql, { facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT || 4002 });
  if (!facRes.rows || facRes.rows.length === 0) {
    throw new Error("Facility Code not found for Facility ID: " + facilityId);
  }
  const facilityCode = facRes.rows[0].FACILITYCODE || facRes.rows[0].FacilityCode || facRes.rows[0][0];

  // Step 2: Financial Year
  const yearSql = "SELECT SHAccYear FROM masAccYearSettings WHERE SYSDATE BETWEEN StartDate AND EndDate";
  const yearRes = await db.execute(yearSql, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT || 4002 });
  
  let shAccYear;
  if (yearRes.rows && yearRes.rows.length > 0) {
    shAccYear = yearRes.rows[0].SHACCYEAR || yearRes.rows[0].ShAccYear || yearRes.rows[0][0];
  } else {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    shAccYear = month >= 3
      ? `${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`
      : `${(year - 1).toString().slice(-2)}-${year.toString().slice(-2)}`;
  }

  // Step 3: Find Next Serial Number for 'RF'
  const issueNoPattern = `${facilityCode}/RF/%/${shAccYear}`;
  const seqSql = `
    SELECT LPAD(
      NVL(MAX(TO_NUMBER(SUBSTR(IssueNo, INSTR(IssueNo, '/RF/') + 4, 5))), 0) + 1,
      5,
      '0'
    ) AS RFSLNO
    FROM tbFacilityIssues
    WHERE IssueNo LIKE :issueNoPattern AND IssueType = 'RF'
  `;
  const seqRes = await db.execute(seqSql, { issueNoPattern }, { outFormat: oracledb.OUT_FORMAT_OBJECT || 4002 });
  const rfSlNo = seqRes.rows[0].RFSLNO || seqRes.rows[0].RfSlNo || seqRes.rows[0][0];

  return `${facilityCode}/RF/${rfSlNo}/${shAccYear}`;
}

async function getIncompleteIssue(facilityId) {
  const sql = `
    SELECT 
      a.IssueID as "IssueID",
      a.IssueNo as "IssueNo",
      a.warehouseid as "WarehouseID",
      b.warehousename as "WarehouseName",
      TO_CHAR(a.IssueDate, 'YYYY-MM-DD') as "IssueDate",
      TO_CHAR(a.WrequestDate, 'YYYY-MM-DD') as "WRequestDate",
      a.WRequestBy as "WRequestBy",
      a.Status as "Status"
    FROM tbFacilityIssues a
    LEFT JOIN maswarehouses b ON a.warehouseid = b.warehouseid
    WHERE a.FacilityID = :facilityId 
      AND a.IssueType = 'RF'
      AND (NVL(a.Status, 'IN') = 'IN' OR NVL(a.returnStatus, 0) = 0)
      AND ROWNUM = 1
    ORDER BY a.IssueID DESC
  `;
  try {
    const result = await db.execute(sql, { facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT || 4002 });
    return result.rows && result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error("Error fetching incomplete issue:", error);
    return null;
  }
}

async function getHeaderInfo(issueId, facilityId) {
  const sql = `
    SELECT 
      a.IssueID as "issueId",
      a.FacilityID as "facilityId",
      a.IssueNo as "issueNo",
      TO_CHAR(a.IssueDate, 'YYYY-MM-DD') as "issueDate",
      TO_CHAR(a.WrequestDate, 'YYYY-MM-DD') as "wRequestDate",
      a.warehouseid as "warehouseId",
      b.warehousename as "warehouseName",
      a.WRequestBy as "wRequestBy",
      a.Status as "status",
      a.returnStatus as "returnStatus"
    FROM tbFacilityIssues a
    LEFT JOIN maswarehouses b ON a.warehouseid = b.warehouseid
    WHERE a.IssueID = :issueId AND a.FacilityID = :facilityId
  `;
  const result = await db.execute(sql, { issueId, facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT || 4002 });
  return result.rows && result.rows.length > 0 ? result.rows[0] : null;
}

function toOracleDateStr(dStr) {
  if (!dStr) return null;
  const str = String(dStr).trim().split('T')[0];
  const parts = str.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`;
    } else if (parts[2].length === 4) {
      return `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`;
    }
  }
  return str;
}

async function createIssueHeader(facilityId, warehouseId, issueNo, issueDate, requestDate, requestBy) {
  const formattedIssueDate = toOracleDateStr(issueDate);
  const formattedReqDate = toOracleDateStr(requestDate || issueDate);
  const sql = `
    INSERT INTO tbFacilityIssues (
      FacilityID, IssueNo, IssueDate, warehouseid, WRequestBy, WrequestDate, ISSUETYPE, returnStatus, Status
    ) VALUES (
      :facilityId, :issueNo, TO_DATE(:formattedIssueDate, 'DD-MM-YYYY'), :warehouseId, :requestBy, TO_DATE(:formattedReqDate, 'DD-MM-YYYY'), 'RF', 0, 'IN'
    )
  `;
  await db.execute(sql, { facilityId, warehouseId, issueNo, formattedIssueDate, formattedReqDate, requestBy });

  const getSql = `
    SELECT IssueID as "issueId" FROM tbFacilityIssues 
    WHERE FacilityID = :facilityId AND IssueNo = :issueNo
  `;
  const res = await db.execute(getSql, { facilityId, issueNo }, { outFormat: oracledb.OUT_FORMAT_OBJECT || 4002 });
  return res.rows[0].issueId || res.rows[0].ISSUEID;
}

async function updateIssueHeader(issueId, facilityId, warehouseId, issueNo, issueDate, requestDate, requestBy) {
  const formattedIssueDate = toOracleDateStr(issueDate);
  const formattedReqDate = toOracleDateStr(requestDate || issueDate);
  const sql = `
    UPDATE tbFacilityIssues
    SET warehouseid = :warehouseId,
        IssueDate = TO_DATE(:formattedIssueDate, 'DD-MM-YYYY'),
        WRequestBy = :requestBy,
        WrequestDate = TO_DATE(:formattedReqDate, 'DD-MM-YYYY')
    WHERE IssueID = :issueId AND FacilityID = :facilityId
  `;
  await db.execute(sql, { issueId, facilityId, warehouseId, formattedIssueDate, formattedReqDate, requestBy });
  return true;
}

async function deleteIssueHeader(issueId, facilityId) {
  const deleteItemsSql = `DELETE FROM tbFacilityIssueItems WHERE IssueID = :issueId`;
  await db.execute(deleteItemsSql, { issueId });

  const deleteHeaderSql = `DELETE FROM tbFacilityIssues WHERE IssueID = :issueId AND FacilityID = :facilityId`;
  await db.execute(deleteHeaderSql, { issueId, facilityId });
  return true;
}

async function getIssueItems(issueId, facilityId) {
  const sql = `
    SELECT 
      m1.ItemID as "itemId",
      m1.ItemCode as "itemCode",
      m1.ItemName as "itemName",
      m1.Strength1 as "strength",
      m1.Unit as "sku",
      m1.PackingQty as "packQty",
      a.IssueItemID as "issueItemId",
      a.IssueQty as "issueQty",
      a.Allotted as "allotted",
      a.CurrentStock as "curStock",
      a.Remarks as "remarks"
    FROM vmasItems m1
    INNER JOIN tbFacilityIssueItems a ON (a.ItemID = m1.ItemID)
    INNER JOIN tbFacilityIssues a1 ON (a1.IssueID = a.IssueID)
    WHERE a.IssueID = :issueId
    ORDER BY a.IssueItemID
  `;
  const result = await db.execute(sql, { issueId }, { outFormat: oracledb.OUT_FORMAT_OBJECT || 4002 });
  return result.rows || [];
}

async function getFacilityStock(facilityId, itemId) {
  try {
    const sql = `SELECT getItem_StockbyFacility(:itemId, :facilityId) AS "curStock" FROM DUAL`;
    const res = await db.execute(sql, { itemId, facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT || 4002 });
    return res.rows[0]?.curStock ?? 0;
  } catch (e) {
    console.error("Error fetching facility stock using function:", e);
    return 0;
  }
}

async function getItemMultiple(itemId) {
  const sql = `
    SELECT Multiple FROM masitems WHERE itemid = :itemId
    UNION
    SELECT Multiple FROM lpmasitems WHERE lpitemid = :itemId
  `;
  try {
    const res = await db.execute(sql, { itemId }, { outFormat: oracledb.OUT_FORMAT_OBJECT || 4002 });
    if (res.rows && res.rows.length > 0) {
      return res.rows[0].MULTIPLE || res.rows[0].Multiple || res.rows[0][0] || 1;
    }
  } catch (e) {
    console.error("Error fetching item multiple:", e);
  }
  return 1;
}

async function getBatchesForItem(facilityId, issueItemId, itemId) {
  const sql = `
    SELECT 
      0 AS "slNo",
      :issueItemId AS "issueItemId",
      x.itemid AS "itemId",
      x.FacReceiptItemID AS "facReceiptItemId",
      BatchNo AS "batchNo",
      TO_CHAR(MfgDate, 'YYYY-MM-DD') AS "mfgDate",
      TO_CHAR(ExpDate, 'YYYY-MM-DD') AS "expDate",
      SUM(AbsRQty) AS "absRQty",
      SUM(NVL(issueQty, 0)) AS "allotQty",
      NVL(y.issueqtyfac, 0) AS "issueQtyFac",
      SUM(AbsRQty) - SUM(NVL(issueQty, 0)) AS "avlQty",
      x.Inwno AS "inwno"
    FROM (
      SELECT DISTINCT rb.FACReceiptItemid FacReceiptItemID, rb.BatchNo, rb.MfgDate, rb.ExpDate,
             iss.issueqty issueQty, NVL(rb.AbsRqty, 0) AbsRQty, rb.Inwno, 0 facoutwardid, i.itemid
      FROM tbFacilityReceiptBatches rb
      INNER JOIN tbfacilityreceiptitems i ON rb.FACreceiptitemid = i.FACreceiptitemid
      INNER JOIN tbfacilityreceipts r ON r.FACreceiptid = i.FACreceiptid
      LEFT OUTER JOIN (
        SELECT tbo.inwno, SUM(tbo.issueqty) issueqty
        FROM tbfacilityissues tb
        INNER JOIN tbfacilityissueitems tbi ON tb.issueid = tbi.issueid
        INNER JOIN tbfacilityoutwards tbo ON tbo.issueitemid = tbi.issueitemid
        GROUP BY tbo.inwno
      ) iss ON iss.inwno = rb.inwno
      WHERE r.status = 'C' AND r.FacilityID = :facilityId AND i.ItemID = :itemId
        AND (rb.ExpDate >= SYSDATE OR NVL(rb.ExpDate, SYSDATE) >= SYSDATE)
        AND TO_DATE(rb.ExpDate, 'dd-MM-yyyy') - TO_DATE(SYSDATE, 'dd-MM-yyyy') >= 15
    ) x
    LEFT OUTER JOIN (
      SELECT inwno, tbi.issueitemid, a.issueqty issueqtyfac
      FROM tbfacilityoutwards a
      INNER JOIN tbfacilityissueitems tbi ON tbi.issueitemid = a.issueitemid
      INNER JOIN tbfacilityissues tb ON tb.issueid = tbi.issueid
      WHERE tbi.issueitemid = :issueItemId
    ) y ON y.inwno = x.Inwno AND y.issueitemid = :issueItemId
    GROUP BY FacReceiptItemID, BatchNo, MfgDate, ExpDate, x.Inwno, y.issueqtyfac, x.itemid
    HAVING NVL((SUM(AbsRQty) - SUM(NVL(issueQty, 0))), 0) > 0
    ORDER BY expdate
  `;
  try {
    const result = await db.execute(sql, { facilityId, issueItemId, itemId }, { outFormat: oracledb.OUT_FORMAT_OBJECT || 4002 });
    return result.rows || [];
  } catch (error) {
    console.error("Error fetching batches for item:", error);
    return [];
  }
}

async function addIssueItem(issueId, itemId, curStock, allotted, issueQty) {
  const seqSql = `SELECT NVL(MAX(IssueItemID), 0) + 1 AS "nextId" FROM tbFacilityIssueItems`;
  const seqRes = await db.execute(seqSql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT || 4002 });
  const nextIssueItemId = seqRes.rows[0].nextId || seqRes.rows[0].NEXTID || seqRes.rows[0][0];

  const sql = `
    INSERT INTO tbFacilityIssueItems (IssueItemID, IssueID, ItemID, CurrentStock, Allotted, IssueQty)
    VALUES (:nextIssueItemId, :issueId, :itemId, :curStock, :allotted, :issueQty)
  `;
  await db.execute(sql, { nextIssueItemId, issueId, itemId, curStock, allotted, issueQty });

  return nextIssueItemId;
}

async function updateIssueItem(issueItemId, itemId, curStock, allotted, issueQty) {
  const sql = `
    UPDATE tbFacilityIssueItems
    SET ItemID = :itemId, CurrentStock = :curStock, Allotted = :allotted, IssueQty = :issueQty
    WHERE IssueItemID = :issueItemId
  `;
  await db.execute(sql, { issueItemId, itemId, curStock, allotted, issueQty });
  return true;
}

async function deleteIssueItem(issueItemId) {
  const sql = `DELETE FROM tbFacilityIssueItems WHERE IssueItemID = :issueItemId`;
  await db.execute(sql, { issueItemId });
  return true;
}

async function completeIssue(issueId, facilityId) {
  const sql = `
    UPDATE tbFacilityIssues
    SET Status = 'C', returnStatus = 1
    WHERE IssueID = :issueId AND FacilityID = :facilityId
  `;
  await db.execute(sql, { issueId, facilityId });
  return true;
}

module.exports = {
  getReturnToWarehouseList,
  getWarehouses,
  generateIssueNo,
  getIncompleteIssue,
  getHeaderInfo,
  createIssueHeader,
  updateIssueHeader,
  deleteIssueHeader,
  getIssueItems,
  getFacilityStock,
  getItemMultiple,
  getBatchesForItem,
  addIssueItem,
  updateIssueItem,
  deleteIssueItem,
  completeIssue
};

