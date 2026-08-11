const db = require('../config/db');

async function getReturnToWarehouseList(facilityId, finYearId, statusId) {
  let statusCondition = '';
  if (statusId === 'IR') {
    statusCondition = "AND NVL(a.Status, 'IN') = 'IN'";
  } else if (statusId === 'CR') {
    statusCondition = "AND NVL(a.Status, 'IN') = 'C'";
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
      a.IssueID as "issueId"
    FROM tbFacilityIssues a 
    INNER JOIN masFacilities fac ON (fac.FacilityID = a.FacilityID) 
    INNER JOIN maswarehouses b ON (b.warehouseid = a.warehouseid) 
    INNER JOIN masStates c ON (c.StateID = fac.StateID) 
    INNER JOIN masDistricts d ON (d.StateID = c.StateID AND d.DistrictID = fac.DistrictID) 
    INNER JOIN masAccYearSettings m1 ON (a.IssueDate BETWEEN m1.StartDate AND m1.EndDate)  
    WHERE a.FacilityID = :facilityId 
      AND m1.AccYrSetID = :finYearId
      AND a.IssueType = 'RF'
      ${statusCondition}
    ORDER BY a.IssueDate DESC
  `;

  const result = await db.execute(sql, { facilityId, finYearId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows || [];
}

async function getWarehouses(facilityId) {
  const sql = `
    SELECT mw.warehouseid as "warehouseId", mw.warehousename as "warehouseName" 
    FROM masfacilitywh mf 
    INNER JOIN MASWAREHOUSES mw ON mf.warehouseid = mw.warehouseid 
    WHERE mf.facilityid = :facilityId
  `;
  const result = await db.execute(sql, { facilityId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows || [];
}

async function getHeader(issueId) {
  const sql = `
    SELECT NVL(a.returnStatus,0) as "returnStatus", a.warehouseid as "warehouseId", 
           a.IssueNo as "issueNo", a.IssueDate as "issueDate", 
           a.WRequestBy as "requestBy", a.WRequestDate as "requestDate", a.IssueID as "issueId" 
    FROM tbFacilityIssues a 
    WHERE a.IssueID = :issueId
  `;
  const result = await db.execute(sql, { issueId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows && result.rows.length > 0 ? result.rows[0] : null;
}

async function createHeader(data) {
  const { facilityId, issueNo, issueDate, warehouseId, requestBy, status } = data;
  const sql = `
    INSERT INTO tbFacilityIssues (FacilityID, IssueNo, IssueDate, warehouseid, WRequestBy, ISSUETYPE, returnStatus) 
    VALUES (:facilityId, :issueNo, TO_DATE(:issueDate, 'YYYY-MM-DD'), :warehouseId, :requestBy, 'RF', :status) 
    RETURNING IssueID INTO :issueId
  `;
  
  const binds = {
    facilityId,
    issueNo,
    issueDate,
    warehouseId,
    requestBy,
    status,
    issueId: { type: db.oracledb?.NUMBER, dir: db.oracledb?.BIND_OUT }
  };
  
  const result = await db.execute(sql, binds, { autoCommit: true });
  return result.outBinds.issueId[0];
}

async function updateHeader(issueId, data) {
  const { warehouseId, issueDate, requestBy, status } = data;
  const sql = `
    UPDATE tbFacilityIssues 
    SET TOFACILITYID = :warehouseId, warehouseid = :warehouseId, 
        IssueDate = TO_DATE(:issueDate, 'YYYY-MM-DD'), WRequestBy = :requestBy, returnStatus = :status 
    WHERE IssueID = :issueId
  `;
  await db.execute(sql, { warehouseId, issueDate, requestBy, status, issueId }, { autoCommit: true });
}

async function getItems(issueId, facilityId) {
  const sql = `
    SELECT 
      m1.ItemID as "itemId", m1.ItemCode as "itemCode", m1.ItemName as "itemName", 
      m1.Strength1 as "strength", m1.Unit as "sku", a.IssueItemID as "issueItemId", 
      a.IssueQty as "issueQty", getItem_StockbyFacility(a.ItemID, :facilityId) as "curStock", 
      a.Allotted as "allotted", a.Remarks as "remarks", 
      (getItem_StockbyFacility(a.ItemID, :facilityId) + NVL(a.IssueQty,0)) as "prevStock" 
    FROM vmasItems m1 
    INNER JOIN tbFacilityIssueItems a ON a.ItemID = m1.ItemID 
    INNER JOIN tbFacilityIssues a1 ON a1.IssueID = a.IssueID 
    WHERE a.IssueID = :issueId 
    ORDER BY a.IssueItemID
  `;
  const result = await db.execute(sql, { issueId, facilityId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows || [];
}

async function addItem(data) {
  const { issueId, itemId, curStock, allotted, issueQty } = data;
  const sql = `
    INSERT INTO tbFacilityIssueItems (IssueID, ItemID, CurrentStock, Allotted, IssueQty) 
    VALUES (:issueId, :itemId, :curStock, :allotted, :issueQty) 
    RETURNING IssueItemID INTO :issueItemId
  `;
  const binds = {
    issueId, itemId, curStock, allotted, issueQty,
    issueItemId: { type: db.oracledb?.NUMBER, dir: db.oracledb?.BIND_OUT }
  };
  const result = await db.execute(sql, binds, { autoCommit: true });
  return result.outBinds.issueItemId[0];
}

async function updateItem(issueItemId, data) {
  const { curStock, allotted, issueQty } = data;
  const sql = `
    UPDATE tbFacilityIssueItems 
    SET CurrentStock = :curStock, Allotted = :allotted, IssueQty = :issueQty 
    WHERE IssueItemID = :issueItemId
  `;
  await db.execute(sql, { curStock, allotted, issueQty, issueItemId }, { autoCommit: true });
}

async function deleteItem(issueItemId) {
  const sql = `DELETE FROM tbFacilityIssueItems WHERE IssueItemID = :issueItemId`;
  await db.execute(sql, { issueItemId }, { autoCommit: true });
}

async function completeIssue(issueId) {
  const sql = `UPDATE tbFacilityIssues SET Status = 'C' WHERE IssueID = :issueId`;
  await db.execute(sql, { issueId }, { autoCommit: true });
}

module.exports = {
  getReturnToWarehouseList,
  getWarehouses,
  getHeader,
  createHeader,
  updateHeader,
  getItems,
  addItem,
  updateItem,
  deleteItem,
  completeIssue
};
