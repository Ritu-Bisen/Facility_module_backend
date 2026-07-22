const oracledb = require('oracledb');
const db = require('../config/db');

async function getIndentHeader(nocId) {
    const query = `
        SELECT f.facilityname, a.fromfacilityid, a.DispatchNo, 
               TO_CHAR(a.DispatchDate,'YYYY-MM-DD') as DispatchDate, 
               a.indentid as NOCID, a.indentNo as NOCNumber,
               TO_CHAR(indentdate,'YYYY-MM-DD') as NOCDATE,
               CASE a.Status  
                   WHEN 'A' THEN 'Approved'  
                   WHEN 'I' THEN 'Incomplete'
                   WHEN 'S' THEN 'Sent for Approval'  
                   WHEN 'C' THEN 'Completed'  
                   WHEN 'D' THEN 'Deleted' 
               END as statusR,
               NVL(a.Status,'I') as Status,
               c.AccYear, a.facilityid as facilityid, a.accyrsetid
        FROM MASFACTRANSFERS a 
        INNER JOIN masaccyearsettings c ON a.accyrsetid = c.accyrsetid 
        INNER JOIN masfacilities f ON f.facilityid = a.facilityid
        WHERE a.indentid = :nocId
        ORDER BY a.indentdate
    `;
    const binds = { nocId };
    const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows || [];
}

async function getIssueHeader(issueId) {
    const query = `
        SELECT IssueID, FacilityID, IssueNo, 
               TO_CHAR(IssueDate, 'YYYY-MM-DD') as IssueDate, 
               TOFACILITYID, WRequestBy as Remarks, ISSUETYPE, IssueEDL, FacIndentID
        FROM tbFacilityIssues
        WHERE IssueID = :issueId
    `;
    const binds = { issueId };
    const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows || [];
}

async function createIssueHeader(facilityId, toFacilityId, issueDate, remarks, facIndentId) {
    try {
        // 1. Get facilityCode
        const facQuery = `SELECT facilitycode FROM masfacilities WHERE facilityid = :facilityId`;
        const facResult = await db.execute(facQuery, { facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const facilityCode = facResult.rows[0] ? facResult.rows[0].FACILITYCODE : 'XXXXX';

        // 2. Get shaccyear
        const accQuery = `SELECT shaccyear FROM masaccyearsettings WHERE sysdate BETWEEN startdate AND enddate FETCH FIRST 1 ROWS ONLY`;
        const accResult = await db.execute(accQuery, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const shaccyear = accResult.rows[0] ? accResult.rows[0].SHACCYEAR : '26-27';

        // 3. Get next sequence for TR
        const seqQuery = `
            SELECT NVL(MAX(TO_NUMBER(REGEXP_SUBSTR(IssueNo, '[0-9]+', 1, 2))), 0) + 1 as NEXT_SEQ
            FROM tbFacilityIssues 
            WHERE FacilityID = :facilityId AND IssueNo LIKE '%/TR/%'
        `;
        const seqResult = await db.execute(seqQuery, { facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const nextSeqNum = seqResult.rows[0] ? seqResult.rows[0].NEXT_SEQ : 1;
        const nextSeqStr = String(nextSeqNum).padStart(5, '0');

        // 4. Construct IssueNo
        const nextNo = `${facilityCode}/TR/${nextSeqStr}/${shaccyear}`;
        
        const insertQuery = `
            INSERT INTO tbFacilityIssues (
                FacilityID, IssueNo, IssueDate, TOFACILITYID, WRequestBy, ISSUETYPE, IssueEDL, FacIndentID
            ) VALUES (
                :facilityId, 
                :nextNo,
                TO_DATE(:issueDate, 'YYYY-MM-DD'),
                :toFacilityId,
                :remarks,
                'SP',
                1,
                :facIndentId
            ) RETURNING IssueID INTO :issueId
        `;
        
        const binds = {
            facilityId,
            nextNo,
            issueDate,
            toFacilityId,
            remarks,
            facIndentId,
            issueId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
        };

        const result = await db.execute(insertQuery, binds, { autoCommit: true });
        return result.outBinds.issueId[0];
    } catch (err) {
        throw err;
    }
}

async function updateIssueHeader(issueId, issueDate, remarks) {
    const query = `
        UPDATE tbFacilityIssues 
        SET IssueDate = TO_DATE(:issueDate, 'YYYY-MM-DD'),
            WRequestBy = :remarks,
            IssueEDL = 1
        WHERE IssueID = :issueId
    `;
    const binds = { issueDate, remarks, issueId };
    const result = await db.execute(query, binds, { autoCommit: true });
    return result;
}

async function getItemsForIssue(nocId, issueId, facilityId) {
    // If issueId is 0 or null, we pass '0' to the SQL so it doesn't break.
    const safeIssueId = issueId || 0;
    
    const query = `
        SELECT m1.ItemID, m1.ItemCode, m1.ItemName, NVL(b.APPROVEDQTY,0) as requestedqty,
               m1.Strength1 as Strength, m1.Unit as SKU, iss.IssueItemID,
               NVL(iss.IssueQty,0) as IssueQty, NVL(cr.CurStock,0) as CurStock,
               NVL(iss.Allotted,0) as Allotted, a.Remarks, 
               NVL(cr.CurStock,0) as CurBal, 
               NVL(cr.CurStock,0) + NVL(iss.IssueQty,0) as PrevStock
        FROM vmasItems m1
        INNER JOIN MasFacDemandItems b ON b.itemid = m1.itemid
        INNER JOIN MASFACTRANSFERS a ON a.indentid = b.indentid
        LEFT OUTER JOIN (
            SELECT a.itemid, a.IssueItemID, a.IssueQty, a.Allotted, a1.facindentid 
            FROM tbFacilityIssueItems a 
            LEFT OUTER JOIN tbFacilityIssues a1 ON (a1.IssueID = a.IssueID)  
            WHERE a1.issueid = :issueId
        ) iss ON iss.facindentid = a.indentid AND iss.itemid = m1.itemid
        LEFT OUTER JOIN (
            SELECT i.itemid, SUM(NVL(rb.AbsRqty,0)) - SUM(NVL(x.issueQty,0)) as CurStock
            FROM tbFacilityReceiptBatches rb  
            INNER JOIN tbfacilityreceiptitems i ON rb.FACreceiptitemid = i.FACreceiptitemid  
            INNER JOIN tbfacilityreceipts r ON r.FACreceiptid = i.FACreceiptid 
            LEFT OUTER JOIN (
                SELECT FacilityID, SUM(NVL(a.IssueQty,0)) as issueQty, 0 as AbsRQty, a.Inwno   
                FROM tbfacilityoutwards a
                INNER JOIN tbfacilityissueitems tbi ON tbi.issueitemid = a.issueitemid   
                INNER JOIN tbfacilityissues tb ON tb.issueid = tbi.issueid    
                WHERE tb.FacilityID = :facilityId  
                GROUP BY a.Inwno, FacilityID   
            ) x ON x.inwno = rb.inwno AND x.FacilityID = r.FacilityID
            WHERE (rb.ExpDate >= SYSDATE OR NVL(rb.ExpDate, SYSDATE) >= SYSDATE)
              AND r.status = 'C'
              AND r.FacilityID = :facilityId
            GROUP BY i.itemid 
            HAVING (SUM(NVL(rb.AbsRqty,0)) - SUM(NVL(x.issueQty,0))) > 0
        ) cr ON cr.ItemID = m1.ItemID
        WHERE a.indentid = :nocId
        ORDER BY iss.IssueItemid
    `;
    
    const binds = { issueId: safeIssueId, facilityId, nocId };
    const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows || [];
}

async function getBatches(facilityId, issueItemId, itemId) {
    const query = `
      SELECT
          ri.FacReceiptItemID,
          rb.BatchNo,
          rb.MfgDate,
          rb.ExpDate,
          NVL(a.IssueQty,0) IssueQty,
          rb.Inwno,
          NVL(mr.locationno,'0') StockLocation
      FROM tbfacilityoutwards a
      INNER JOIN tbfacilityissueitems tbi
          ON tbi.issueitemid = a.issueitemid
      INNER JOIN tbfacilityissues tb
          ON tb.issueid = tbi.issueid
      INNER JOIN tbFacilityReceiptBatches rb
          ON rb.inwno = a.inwno
          AND rb.facreceiptitemid = a.facreceiptitemid
          AND (rb.whissueblock IS NULL OR rb.whissueblock = 0)
      LEFT JOIN masracks mr
          ON mr.rackid = rb.StockLocation
      INNER JOIN tbfacilityreceiptitems ri
          ON ri.facreceiptitemid = rb.facreceiptitemid
      WHERE tb.FacilityID = :facilityId
      AND tbi.IssueItemID = :issueItemId
      AND tbi.ItemID = :itemId
      ORDER BY rb.expdate
    `;

    const result = await db.execute(
      query,
      {
        facilityId,
        issueItemId,
        itemId,
      },
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      }
    );

    return result.rows || [];
}

module.exports = {
    getIndentHeader,
    getIssueHeader,
    createIssueHeader,
    updateIssueHeader,
    getItemsForIssue,
    getBatches
};
