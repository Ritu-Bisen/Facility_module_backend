const db = require('../config/db');
const oracledb = require('oracledb');

async function getTransfers(facilityId, accYrSetId, status) {
    let statusClause = '';
    const binds = { facilityId, accYrSetId };

    if (status && status !== 'All') {
        const statusMap = { Incomplete: 'I', Completed: 'C' };
        const dbStatus = statusMap[status] || status;
        statusClause = `AND NVL(i.Status, 'I') = :status`;
        binds.status = dbStatus;
    }

    const query = `
        SELECT 
            f.FacilityName as "facilityname",
            i.FacilityID as "fromfacilityid",
            NULL as "DispatchNo",
            NULL as "DispatchDate",
            NVL(i.FacIndentID, 0) as "NOCID",
            NVL(a.IndentNo, '—') as "NOCNumber",
            NVL(TO_CHAR(a.IndentDate, 'DD-MM-YYYY'), '—') as "NOCDATE",
            CASE NVL(i.Status, 'I')
                WHEN 'I' THEN 'Incomplete'
                WHEN 'IN' THEN 'Incomplete'
                WHEN 'C' THEN 'Completed'
                ELSE 'Completed'
            END as "statusR",
            NVL(i.Status, 'I') as "Status",
            c.AccYear as "AccYear",
            i.TOFACILITYID as "facilityid",
            c.AccYrSetID as "accyrsetid",
            i.IssueID as "issueid",
            i.IssueNo as "ISSUENO",
            TO_CHAR(i.IssueDate, 'DD-MM-YYYY') as "ISSUEDATE"
        FROM tbFacilityIssues i
        LEFT OUTER JOIN MASFACTRANSFERS a ON a.IndentID = i.FacIndentID
        INNER JOIN masAccYearSettings c ON TRUNC(i.IssueDate) BETWEEN c.StartDate AND NVL(c.EndDate, SYSDATE + 1000)
        INNER JOIN masFacilities f ON f.FacilityID = i.TOFACILITYID
        WHERE i.ISSUETYPE = 'SH'
          AND i.FacilityID = :facilityId 
          AND c.AccYrSetID = :accYrSetId
          ${statusClause}
        ORDER BY i.IssueID DESC
    `;

    try {
        const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows || [];
    } catch (err) {
        console.error("Error executing getTransfers query.", err);
        throw err;
    }
}

async function getHeaderInfo(nocId) {
    const query = `
        SELECT 
            f.FacilityName as "facilityname",
            a.FromFacilityID as "fromfacilityid",
            a.DispatchNo as "DispatchNo",
            TO_CHAR(a.DispatchDate, 'DD-MM-YYYY') as "DispatchDate",
            a.IndentID as "NOCID",
            a.IndentNo as "NOCNumber",
            TO_CHAR(a.IndentDate, 'DD-MM-YYYY') as "NOCDATE",
            CASE a.Status
                WHEN 'A' THEN 'Approved'
                WHEN 'I' THEN 'Incomplete'
                WHEN 'S' THEN 'Sent for Approval'
                WHEN 'C' THEN 'Completed'
                WHEN 'D' THEN 'Deleted'
            END as "statusR",
            NVL(a.Status, 'I') as "Status",
            c.AccYear as "AccYear",
            a.FacilityID as "facilityid",
            a.AccYrSetID as "accyrsetid",
            NVL(a.MTRANSFERID, 0) as "MTRANSFERID"
        FROM MASFACTRANSFERS a 
        INNER JOIN masAccYearSettings c ON a.AccYrSetID = c.AccYrSetID 
        INNER JOIN masFacilities f ON f.FacilityID = a.FacilityID
        WHERE a.IndentID = :nocId
    `;

    try {
        const result = await db.execute(query, { nocId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (err) {
        console.error("Error executing getHeaderInfo query.", err);
        throw err;
    }
}

async function getIssueHeaderByNocId(nocId) {
    const query = `
        SELECT 
            IssueID as "IssueID",
            FacilityID as "FacilityID",
            IssueNo as "IssueNo",
            TO_CHAR(IssueDate, 'YYYY-MM-DD') as "IssueDate",
            TOFACILITYID as "TOFACILITYID",
            WRequestBy as "WRequestBy",
            ISSUETYPE as "ISSUETYPE",
            IssueEDL as "IssueEDL",
            FacIndentID as "FacIndentID",
            MISSUEID as "MISSUEID",
            Status as "Status"
        FROM tbFacilityIssues 
        WHERE FacIndentID = :nocId
    `;
    try {
        const result = await db.execute(query, { nocId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (err) {
        console.error("Error executing getIssueHeaderByNocId query.", err);
        throw err;
    }
}

async function generateIssueNo(facilityId) {
    let connection;
    try {
        connection = await oracledb.getConnection();
        
        const facQuery = `SELECT FacilityCode FROM masFacilities WHERE FacilityID = :facilityId`;
        const facResult = await connection.execute(facQuery, { facilityId });
        if (!facResult.rows || facResult.rows.length === 0) {
            throw new Error(`Facility not found for ID: ${facilityId}`);
        }
        const facilityCode = facResult.rows[0][0];

        const yrQuery = `
            SELECT SHAccYear 
            FROM masAccYearSettings 
            WHERE SYSDATE BETWEEN StartDate AND EndDate
        `;
        const yrResult = await connection.execute(yrQuery);
        let shAccYear = '';
        if (yrResult.rows && yrResult.rows.length > 0) {
            shAccYear = yrResult.rows[0][0];
        } else {
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth() + 1;
            if (currentMonth >= 4) {
                shAccYear = `${currentYear}-${(currentYear + 1).toString().substring(2)}`;
            } else {
                shAccYear = `${currentYear - 1}-${currentYear.toString().substring(2)}`;
            }
        }

        const issueNoPattern = `${facilityCode}/TR/%/${shAccYear}`;

        const seqQuery = `
            SELECT 
                NVL(MAX(TO_NUMBER(SUBSTR(IssueNo, INSTR(IssueNo, '/TR/') + 4, 5))), 0) + 1
            FROM tbFacilityIssues
            WHERE IssueNo LIKE :issueNoPattern
        `;
        
        const seqResult = await connection.execute(seqQuery, { issueNoPattern });
        let nextSeq = 1;
        if (seqResult.rows && seqResult.rows.length > 0) {
            nextSeq = seqResult.rows[0][0];
        }

        const sequenceStr = nextSeq.toString().padStart(5, '0');
        const generatedNo = `${facilityCode}/TR/${sequenceStr}/${shAccYear}`;
        
        return generatedNo;
    } catch (error) {
        console.error("Error generating issue no:", error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
}

async function saveIssueHeader(data) {
    let connection;
    try {
        connection = await oracledb.getConnection();
        
        const query = `
            INSERT INTO tbFacilityIssues 
            (FacilityID, IssueNo, IssueDate, TOFACILITYID, WRequestBy, ISSUETYPE, IssueEDL, FacIndentID) 
            VALUES (:facilityId, :issueNo, TO_DATE(:issueDate, 'YYYY-MM-DD'), :toFacilityId, :requestBy, 'SP', 1, :facIndentId)
            RETURNING IssueID INTO :newId
        `;
        
        const binds = {
            facilityId: data.facilityId,
            issueNo: data.issueNo,
            issueDate: data.issueDate,
            toFacilityId: data.toFacilityId,
            requestBy: data.requestBy || '',
            facIndentId: data.facIndentId,
            newId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
        };
        
        const result = await connection.execute(query, binds, { autoCommit: true });
        return result.outBinds.newId[0];
    } catch (error) {
        console.error("Error saving issue header:", error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
}

async function generateDirectIssueNo(data) {
    let connection;
    try {
        connection = await oracledb.getConnection();
        
        const facilityCode = data.facilityId;

        // 2. Get financial year
        const yrQuery = `
            SELECT SHAccYear 
            FROM masAccYearSettings 
            WHERE SYSDATE BETWEEN StartDate AND EndDate
        `;
        const yrResult = await connection.execute(yrQuery);
        let shAccYear = '';
        if (yrResult.rows && yrResult.rows.length > 0) {
            shAccYear = yrResult.rows[0][0];
        } else {
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth() + 1;
            if (currentMonth >= 4) {
                shAccYear = `${currentYear}-${(currentYear + 1).toString().substring(2)}`;
            } else {
                shAccYear = `${currentYear - 1}-${currentYear.toString().substring(2)}`;
            }
        }

        // 3. Generate issue no (format: FCODE/SH/XXXXX/YY-YY)
        const issueNoPattern = `${facilityCode}/SH/%/${shAccYear}`;

        const seqQuery = `
            SELECT 
                NVL(MAX(TO_NUMBER(SUBSTR(IssueNo, INSTR(IssueNo, '/SH/') + 4, 5))), 0) + 1
            FROM tbFacilityIssues
            WHERE IssueNo LIKE :issueNoPattern
        `;
        
        const seqResult = await connection.execute(seqQuery, { issueNoPattern });
        let nextSeq = 1;
        if (seqResult.rows && seqResult.rows.length > 0) {
            nextSeq = seqResult.rows[0][0];
        }

        const sequenceStr = nextSeq.toString().padStart(5, '0');
        const generatedNo = `${facilityCode}/SH/${sequenceStr}/${shAccYear}`;
        
        // 4. Insert into tbFacilityIssues
        const query = `
            INSERT INTO tbFacilityIssues 
            (FacilityID, IssueNo, IssueDate, TOFACILITYID, WRequestBy, ISSUETYPE, IssueEDL) 
            VALUES (:facilityId, :issueNo, TO_DATE(:issueDate, 'YYYY-MM-DD'), :toFacilityId, :requestBy, 'SH', 1)
            RETURNING IssueID INTO :newId
        `;
        
        const binds = {
            facilityId: data.facilityId,
            issueNo: generatedNo,
            issueDate: data.issueDate,
            toFacilityId: data.toFacilityId,
            requestBy: data.requestBy || '',
            newId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
        };
        
        const result = await connection.execute(query, binds, { autoCommit: true });
        
        return {
            issueId: result.outBinds.newId[0],
            issueNo: generatedNo
        };
    } catch (error) {
        console.error("Error generating direct issue no:", error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
}

async function getItemsForIndent(nocId, issueId, facilityId) {
    const issueIdFilter = issueId || 0;
    
    const query = `
        SELECT 
            m1.ItemID as "ItemID",
            m1.ItemCode as "ItemCode",
            m1.ItemName as "ItemName",
            NVL(b.APPROVEDQTY, 0) as "requestedqty",
            m1.Strength1 as "Strength",
            m1.Unit as "SKU",
            iss.IssueItemID as "IssueItemID",
            NVL(iss.IssueQty, 0) as "IssueQty",
            NVL(cr.CurStock, 0) as "CurStock",
            NVL(iss.Allotted, 0) as "Allotted"
        FROM vmasItems m1
        INNER JOIN MasFacDemandItems b ON b.itemid = m1.itemid
        INNER JOIN MASFACTRANSFERS a ON a.indentid = b.indentid
        LEFT OUTER JOIN (
            SELECT 
                a.itemid, 
                IssueItemID,
                a.IssueQty,
                a.Allotted,
                a1.facindentid 
            FROM tbFacilityIssueItems a 
            LEFT OUTER JOIN tbFacilityIssues a1 ON a1.IssueID = a.IssueID  
            WHERE a1.issueid = :issueIdFilter
        ) iss ON iss.facindentid = a.indentid AND iss.itemid = m1.itemid
        LEFT OUTER JOIN (
            SELECT 
                i.itemid,  
                SUM(NVL(rb.AbsRqty, 0)) - SUM(NVL(x.issueQty, 0)) as CurStock
            FROM tbFacilityReceiptBatches rb  
            INNER JOIN tbfacilityreceiptitems i ON rb.FACreceiptitemid = i.FACreceiptitemid  
            INNER JOIN tbfacilityreceipts r ON r.FACreceiptid = i.FACreceiptid 
            LEFT OUTER JOIN (
                SELECT  
                    FacilityID,
                    SUM(NVL(a.IssueQty, 0)) issueQty, 
                    a.Inwno   
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
            HAVING (SUM(NVL(rb.AbsRqty, 0)) - SUM(NVL(x.issueQty, 0))) > 0
        ) cr ON cr.ItemID = m1.ItemID
        WHERE a.indentid = :nocId
        ORDER BY iss.IssueItemID
    `;
    
    try {
        const result = await db.execute(query, { nocId, issueIdFilter, facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows || [];
    } catch (err) {
        console.error("Error executing getItemsForIndent query:", err);
        throw err;
    }
}

async function saveIssueItem(data) {
    let connection;
    try {
        connection = await oracledb.getConnection();
        
        let issueItemId = data.issueItemId;
        
        if (!issueItemId || issueItemId == '0') {
            const query = `
                INSERT INTO tbFacilityIssueItems 
                (IssueID, ItemID, CurrentStock, Allotted, IssueQty) 
                VALUES (:issueId, :itemId, :curStock, :allotted, :issueQty)
                RETURNING IssueItemID INTO :newId
            `;
            
            const binds = {
                issueId: data.issueId,
                itemId: data.itemId,
                curStock: data.curStock,
                allotted: data.allotted,
                issueQty: data.issueQty,
                newId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
            };
            
            const result = await connection.execute(query, binds, { autoCommit: true });
            issueItemId = result.outBinds.newId[0];
        } else {
            const query = `
                UPDATE tbFacilityIssueItems 
                SET IssueID = :issueId, ItemID = :itemId, CurrentStock = :curStock, 
                    Allotted = :allotted, IssueQty = :issueQty 
                WHERE IssueItemID = :issueItemId
            `;
            const binds = {
                issueId: data.issueId,
                itemId: data.itemId,
                curStock: data.curStock,
                allotted: data.allotted,
                issueQty: data.issueQty,
                issueItemId: issueItemId
            };
            await connection.execute(query, binds, { autoCommit: true });
        }
        
        // Also need to generate tbFacilityOutwards allocation for batches (using GenFunctions.Stock.UpdateFacilityAllotQtyOPMRDB equivalent)
        // Since we are mocking/approximating this backend complexity for React conversion:
        await generateOutwards(connection, data.facilityId, data.itemId, data.issueQty, issueItemId);
        
        return issueItemId;
    } catch (error) {
        console.error("Error saving issue item:", error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
}

async function generateOutwards(connection, facilityId, itemId, issueQty, issueItemId) {
    // Basic FIFO logic for tbFacilityOutwards
    
    // Clear old outwards for this item
    await connection.execute(`DELETE FROM tbFacilityOutwards WHERE IssueItemID = :issueItemId`, { issueItemId });
    
    if (issueQty <= 0) return;
    
    // Find available batches
    const query = `
        SELECT rb.Inwno, rb.FacReceiptItemID, (rb.AbsRqty - NVL(x.issueQty, 0)) as AvailQty
        FROM tbFacilityReceiptBatches rb
        INNER JOIN tbfacilityreceiptitems i ON rb.FACreceiptitemid = i.FACreceiptitemid
        INNER JOIN tbfacilityreceipts r ON r.FACreceiptid = i.FACreceiptid
        LEFT OUTER JOIN (
            SELECT a.Inwno, SUM(NVL(a.IssueQty, 0)) as issueQty
            FROM tbfacilityoutwards a
            INNER JOIN tbfacilityissueitems tbi ON tbi.issueitemid = a.issueitemid
            INNER JOIN tbfacilityissues tb ON tb.issueid = tbi.issueid
            WHERE tb.FacilityID = :facilityId
            GROUP BY a.Inwno
        ) x ON x.Inwno = rb.Inwno
        WHERE i.itemid = :itemId
          AND r.FacilityID = :facilityId
          AND r.status = 'C'
          AND (rb.ExpDate >= SYSDATE OR rb.ExpDate IS NULL)
          AND (rb.AbsRqty - NVL(x.issueQty, 0)) > 0
        ORDER BY rb.ExpDate ASC
    `;
    
    const result = await connection.execute(query, { facilityId, itemId });
    
    let remainingQty = parseFloat(issueQty);
    
    for (const row of result.rows) {
        if (remainingQty <= 0) break;
        
        const inwno = row[0];
        const facReceiptItemId = row[1];
        const availQty = parseFloat(row[2]);
        
        const qtyToIssue = Math.min(availQty, remainingQty);
        
        await connection.execute(`
            INSERT INTO tbFacilityOutwards (IssueItemID, Inwno, FacReceiptItemID, IssueQty, Status, Issued)
            VALUES (:issueItemId, :inwno, :facReceiptItemId, :qtyToIssue, 'I', 0)
        `, { issueItemId, inwno, facReceiptItemId, qtyToIssue }, { autoCommit: true });
        
        remainingQty -= qtyToIssue;
    }
}

async function deleteIssueItem(issueItemId) {
    const query1 = `DELETE FROM tbFacilityOutwards WHERE IssueItemID = :issueItemId`;
    const query2 = `DELETE FROM tbFacilityIssueItems WHERE IssueItemID = :issueItemId`;
    
    let connection;
    try {
        connection = await oracledb.getConnection();
        await connection.execute(query1, { issueItemId });
        await connection.execute(query2, { issueItemId }, { autoCommit: true });
        return true;
    } catch (error) {
        console.error("Error deleting issue item:", error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
}

async function completeIssue(issueId) {
    let connection;
    try {
        connection = await oracledb.getConnection();
        
        const q1 = `UPDATE tbFacilityIssues SET Status = 'C', IssuedDate = SYSDATE WHERE IssueID = :issueId`;
        const q2 = `
            UPDATE tbFacilityOutwards SET Status = 'C', Issued = 1 
            WHERE IssueItemID IN (SELECT IssueItemID FROM tbFacilityIssueItems WHERE IssueID = :issueId)
        `;
        const q3 = `UPDATE tbFacilityIssueItems SET Status = 'C', Issued = 1 WHERE IssueID = :issueId`;
        
        // Also update MASFACTRANSFERS status to C
        const q4 = `
            UPDATE MASFACTRANSFERS SET Status = 'C' 
            WHERE IndentID = (SELECT FacIndentID FROM tbFacilityIssues WHERE IssueID = :issueId)
        `;
        
        await connection.execute(q1, { issueId });
        await connection.execute(q2, { issueId });
        await connection.execute(q3, { issueId });
        await connection.execute(q4, { issueId }, { autoCommit: true });
        
        return true;
    } catch (error) {
        console.error("Error completing issue:", error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
}

async function getAllFacilities() {
    const query = `
        SELECT FacilityID as "facilityId", FacilityName as "facilityName"
        FROM masFacilities
        WHERE FacilityTypeID = 377 OR ISACTIVE = 1
        ORDER BY FacilityName ASC
    `;
    const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows || [];
}

async function getAccYears() {
    const query = `
        SELECT 
            ACCYRSETID as "id",
            AccYear as "year"
        FROM masAccYearSettings
        ORDER BY AccYear DESC
    `;
    const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows || [];
}

async function deleteIssueHeader(issueId) {
    const query = `
        UPDATE tbFacilityIssues
        SET Status = 'D'
        WHERE IssueID = :issueId
    `;
    await db.execute(query, { issueId }, { autoCommit: true });
    return true;
}

module.exports = {
    getTransfers,
    getHeaderInfo,
    getIssueHeaderByNocId,
    generateIssueNo,
    generateDirectIssueNo,
    saveIssueHeader,
    getItemsForIndent,
    saveIssueItem,
    deleteIssueItem,
    deleteIssueHeader,
    completeIssue,
    getAllFacilities,
    getAccYears
};
