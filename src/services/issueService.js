const db = require('../config/db');
const oracledb = require('oracledb');

async function generateIssueNumber(facilityId, type = 'TR') {
    const opts = { outFormat: oracledb.OUT_FORMAT_OBJECT };

    const query = `
        SELECT 
            mf.FacilityCode || '/${type}/' || 
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
            ON ti.IssueNo LIKE mf.FacilityCode || '/${type}/%/' || ay.SHAccYear
        WHERE mf.FacilityID = :facilityId
        GROUP BY mf.FacilityCode, ay.SHAccYear
    `;

    const result = await db.execute(query, { facilityId }, opts);

    if (result.rows.length === 0) {
        return null; // Facility not found or financial year not found
    }

    return result.rows[0].NEXT_ISSUE_NO;
}

async function generateAndSaveIssue(data) {
    const { facilityId, toFacilityId, issueDate, issueType = 'TR', requestBy = 1, remarks = '' } = data;
    
    // 1. Generate Issue Number
    const issueNo = await generateIssueNumber(facilityId, 'TR');
    if (!issueNo) {
        throw new Error('Could not generate Issue No - Facility not found');
    }

    // 2. Insert into tbFacilityIssues
    const insertSql = `
        INSERT INTO tbFacilityIssues (
            FacilityID,
            IssueNo,
            IssueDate,
            TOFACILITYID,
            WRequestBy,
            ISSUETYPE,
            Remarks
        ) VALUES (
            :facilityId,
            :issueNo,
            TO_DATE(:issueDate, 'YYYY-MM-DD'),
            :toFacilityId,
            :requestBy,
            :issueType,
            :remarks
        ) RETURNING IssueID INTO :issueIdOut
    `;

    const binds = {
        facilityId,
        issueNo,
        issueDate, 
        toFacilityId,
        requestBy,
        issueType,
        remarks,
        issueIdOut: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
    };

    const result = await db.execute(insertSql, binds, { autoCommit: true });
    const issueId = result.outBinds.issueIdOut[0];

    return { issueNo, issueId };
}

module.exports = {
    generateIssueNumber,
    generateAndSaveIssue
};
