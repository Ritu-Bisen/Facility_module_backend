const db = require('../config/db');
const oracledb = require('oracledb');

// Fetch financial years for CMHO Status Report (accyrsetid > 534)
async function getCmhoFinYears() {
  try {
    const query = `
      SELECT accyrsetid, accyear,
             CASE WHEN sysdate BETWEEN startdate AND enddate THEN 'Y' ELSE 'N' END AS is_current
      FROM masaccyearsettings 
      WHERE accyrsetid > 534 
      ORDER BY accyrsetid DESC
    `;
    const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (result.rows || []).map(r => ({
      accYrSetId: r.ACCYRSETID || r.accyrsetid,
      accYear: r.ACCYEAR || r.accYear,
      isCurrent: (r.IS_CURRENT || r.is_current) === 'Y'
    }));
  } catch (error) {
    console.error('Error fetching CMHO Fin Years:', error);
    throw error;
  }
}

// Get district ID of facility
async function getFacilityDistrictId(facilityId) {
  try {
    const facId = Number(facilityId) || 0;
    const query = `SELECT NVL(districtid, 0) AS districtid FROM masfacilities WHERE facilityid = :facId`;
    const result = await db.execute(query, { facId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (result.rows && result.rows.length > 0) {
      return Number(result.rows[0].DISTRICTID || result.rows[0].districtid || 0);
    }
    return 0;
  } catch (error) {
    console.error('Error fetching district id for facility:', error);
    throw error;
  }
}

// Populate Annual Indent Upload & Forward Status of District Health Facilities for CMHO
async function getCmhoIndentStatusReport(districtId, finYearId) {
  try {
    const distId = Number(districtId) || 0;
    const fyId = Number(finYearId) || 0;

    const query = `
      SELECT 0 AS SlNo, 
             fm.facilityid, 
             fm.facilityname,
             CASE 
               WHEN ai.status = 'C' THEN 'Annual Indent Uploaded and Forwarded'   
               WHEN ai.status = 'I' THEN 'Annual Indent Uploaded but not Forwarded' 
               ELSE 'Indent Not Forwarded' 
             END AS status
      FROM masfacilities fm 
      LEFT OUTER JOIN (
        SELECT facilityid, status 
        FROM masanualindent 
        WHERE isreagent IS NULL 
          AND accyrsetid = :fyId
      ) ai ON ai.facilityid = fm.facilityid 
      INNER JOIN masfacilitytypes ft ON ft.facilitytypeid = fm.facilitytypeid 
      WHERE fm.districtid = :distId 
        AND fm.isactive = 1 
        AND ft.facilitytypeid IN (369, 352, 353, 356, 358, 365, 381, 372, 379, 385) 
        AND fm.facilityname NOT LIKE '%DHS CM%' 
      ORDER BY ft.orderdp, fm.facilityname
    `;

    const result = await db.execute(query, { distId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (result.rows || []).map((r, idx) => ({
      slNo: idx + 1,
      facilityId: r.FACILITYID || r.facilityid,
      facilityName: r.FACILITYNAME || r.facilityname,
      status: r.STATUS || r.status || 'Indent Not Forwarded'
    }));
  } catch (error) {
    console.error('Error fetching CMHO Indent Status Report:', error);
    throw error;
  }
}

module.exports = {
  getCmhoFinYears,
  getFacilityDistrictId,
  getCmhoIndentStatusReport
};
