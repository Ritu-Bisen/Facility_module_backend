const oracledb = require('oracledb');
const db = require('../config/db');

async function getIndentsForIssue(fromFacilityId, yearId, status) {
    let statusFilter = '';
    const binds = { fromFacilityId, yearId };

    // In the legacy code, the logic for status is based on the issues status (tbfacilityissues.Status) 
    // or the indent status if no issue exists. We will implement it similarly.
    // The legacy C# does:
    // case "IR": strFilterContition += " and NVL(a.Status, 'I') = 'I'"; 
    // Wait, the C# says "NVL(a.Status, 'I') = 'I'" but actually it means the issue status because "a" was used inconsistently.
    // Let's just retrieve them all and filter, or use standard filters.
    if (status && status !== '0' && status !== 'All') {
        // The legacy C# actually meant: NVL(i.Status, 'I') = :status
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

    const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows || [];
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
    const result = await db.execute(query, { indentId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows || [];
}

module.exports = {
    getIndentsForIssue,
    getIssuesForIndent
};
