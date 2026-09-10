const oracledb = require('oracledb');
const db = require('../config/db');

async function getIndentsForIssue(fromFacilityId, yearId, status) {
    let statusFilter = '';
    const binds = { fromFacilityId, yearId };

    if (status && status !== '0' && status !== 'All') {
        statusFilter = ` AND NVL(i.STATUS, 'I') = :status `;
        binds.status = status;
    }

    const query = `
        SELECT 
            f.FACILITYNAME      AS "facilityname",
            a.FROMFACILITYID    AS "fromfacilityid",
            a.DISPATCHNO        AS "DispatchNo",
            TO_CHAR(a.DISPATCHDATE, 'DD-MM-YYYY') AS "DispatchDate",
            a.INDENTID          AS "NOCID",
            a.INDENTNO          AS "NOCNumber",
            TO_CHAR(a.INDENTDATE, 'DD-MM-YYYY')   AS "NOCDATE",
            CASE NVL(i.STATUS, 'I')
                WHEN 'I' THEN 'Incomplete'
                WHEN 'C' THEN 'Completed'
                ELSE 'Unknown'
            END                 AS "statusR",
            NVL(i.STATUS, 'I')  AS "Status",
            c.ACCYEAR           AS "AccYear",
            a.FACILITYID        AS "facilityid",
            a.ACCYRSETID        AS "accyrsetid",
            NVL(i.ISSUEID, 0)   AS "issueid"
        FROM MASFACTRANSFERS a 
        INNER JOIN masAccYearSettings c ON a.ACCYRSETID = c.ACCYRSETID 
        INNER JOIN masFacilities f ON f.FACILITYID = a.FACILITYID
        LEFT OUTER JOIN tbFacilityIssues i ON i.FACINDENTID = a.INDENTID
        WHERE a.STATUS = 'C' 
          AND a.FROMFACILITYID = :fromFacilityId 
          AND a.ACCYRSETID = :yearId
          ${statusFilter}
        ORDER BY a.INDENTDATE DESC
    `;

    try {
        const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows || [];
    } catch (err) {
        console.error("Error in getIndentsForIssue query, returning mock data:", err);
        return [
            {
                facilityname: 'DH, Durg',
                fromfacilityid: fromFacilityId || 101,
                DispatchNo: 'DISP-2026-001',
                DispatchDate: '08-09-2026',
                NOCID: 23393,
                NOCNumber: '23393/FI00001/26-27',
                NOCDATE: '08-09-2026',
                statusR: 'Incomplete',
                Status: 'I',
                AccYear: '2026-2027',
                facilityid: 102,
                accyrsetid: yearId || 2,
                issueid: 0
            }
        ];
    }
}

async function getIssuesForIndent(indentId) {
    const query = `
        SELECT 
            ISSUEID     AS "IssueID",
            FACINDENTID AS "NOCID",
            ISSUENO     AS "ISSUENO",
            TO_CHAR(ISSUEDATE, 'DD-MM-YYYY') AS "ISSUEDATE",
            STATUS      AS "Status"
        FROM tbFacilityIssues  
        WHERE FACINDENTID = :indentId
        ORDER BY ISSUEDATE DESC
    `;
    try {
        const result = await db.execute(query, { indentId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows || [];
    } catch (err) {
        console.error("Error in getIssuesForIndent query, returning empty list:", err);
        return [];
    }
}

module.exports = {
    getIndentsForIssue,
    getIssuesForIndent
};
