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

module.exports = {
  getReturnToWarehouseList
};
