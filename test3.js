const db = require('./src/config/db');

async function test() {
  await db.initialize();
  try {
    const fRes = await db.execute(`SELECT FacilityID FROM masFacilities WHERE FacilityCode = '01109'`);
    const facilityId = fRes.rows[0][0] || fRes.rows[0].FACILITYID;
    console.log("FacilityID:", facilityId);
    
    const query = `
        SELECT 
            mf.FacilityCode || '/TR/' || 
            LPAD(
                NVL(
                    MAX(
                        TO_NUMBER(
                            SUBSTR(ti.IssueNo, -11, 5)
                        )
                    ),
                    0
                ) + 1,
                5,
                '0'
            ) || '/' || ay.SHAccYear AS NEXT_ISSUE_NO
        FROM masFacilities mf
        CROSS JOIN (
            SELECT SHAccYear
            FROM masAccYearSettings
            WHERE TRUNC(SYSDATE) BETWEEN StartDate AND EndDate
        ) ay
        LEFT JOIN tbFacilityIssues ti
            ON ti.IssueNo LIKE mf.FacilityCode || '/TR/%/' || ay.SHAccYear
        WHERE mf.FacilityID = :facilityId
        GROUP BY mf.FacilityCode, ay.SHAccYear
    `;

    const res = await db.execute(query, { facilityId });
    console.log("Next Issue No:", res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await db.close();
  }
}

test();
