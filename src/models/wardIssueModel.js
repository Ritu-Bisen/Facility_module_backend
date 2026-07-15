const db = require('../config/db');

async function getWards(facilityId) {
    const query = `
        Select a.WardID, a.WardName
        from masFacilityWards a
        Where a.IsActive=1 and a.FacilityID=:facilityId
        Order By a.WardName
    `;
    const result = await db.execute(query, { facilityId });
    return result.rows;
}

async function generateIssueNo(facilityId) {
    // Step 1: Get Facility Code
    const facilityResult = await db.execute(
        "SELECT FacilityCode FROM masFacilities WHERE FacilityID = :facilityId",
        { facilityId }
    );
    
    if (!facilityResult.rows || facilityResult.rows.length === 0) {
        throw new Error("Facility Code not found for the given facility ID.");
    }
    
    // In oracledb outFormat depends on config, usually an array or object.
    // If it's an array: rows[0][0]. If object: rows[0].FACILITYCODE.
    // Assuming array format based on earlier fix for wards dropdown:
    let facilityCode = Array.isArray(facilityResult.rows[0]) ? facilityResult.rows[0][0] : facilityResult.rows[0].FACILITYCODE;
    
    // Step 2: Get Current Financial Year
    const yearResult = await db.execute(
        "SELECT SHAccYear FROM masAccYearSettings WHERE SYSDATE BETWEEN StartDate AND EndDate",
        {}
    );
    
    let shAccYear;
    if (!yearResult.rows || yearResult.rows.length === 0) {
        // Fallback to computed financial year (e.g. 26-27) if table has no entry for SYSDATE
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth(); // 0-11
        // Use 2-digit years: e.g. 26-27 (not 2026-27)
        shAccYear = month >= 3
            ? `${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`
            : `${(year - 1).toString().slice(-2)}-${year.toString().slice(-2)}`;
    } else {
        shAccYear = Array.isArray(yearResult.rows[0]) ? yearResult.rows[0][0] : yearResult.rows[0].SHACCYEAR;
    }
    
    // Step 3: Find Last Used Serial Number
    // Pattern: e.g. 01109/NO/%/2025-26  or  01109/NO/%/26-27
    const issueNoPattern = `${facilityCode}/NO/%/${shAccYear}`;

    // IssueNo format: FCODE/NO/00038/2025-26
    // INSTR(IssueNo, '/NO/') finds position of '/NO/' (e.g. pos 6 for '01109/NO/...')
    // +4 skips past '/NO/' to reach the start of the 5-digit serial (e.g. pos 10)
    // SUBSTR(IssueNo, 10, 5) = '00038'  → works for any facility code length or year format
    const serialResult = await db.execute(
        `SELECT LPAD(
           NVL(MAX(TO_NUMBER(SUBSTR(IssueNo, INSTR(IssueNo, '/NO/') + 4, 5))), 0) + 1,
           5,
           '0'
         ) AS WHSlNo
         FROM tbFacilityIssues
         WHERE IssueNo LIKE :issueNoPattern`,
        { issueNoPattern }
    );
    
    let whSlNo = Array.isArray(serialResult.rows[0]) ? serialResult.rows[0][0] : serialResult.rows[0].WHSLNO;
    
    // Step 4: Construct Issue Number: e.g. 01109/NO/00038/26-27
    return `${facilityCode}/NO/${whSlNo}/${shAccYear}`;
}


async function getItems(facilityId) {
    const query = `
        select  mi.itemid,(mi.itemcode || '-' || mi.itemname|| '-' || mi.strength1) as itemname
        from tbFacilityReceiptBatches rb  
        inner join tbfacilityreceiptitems i on rb.FACreceiptitemid=i.FACreceiptitemid  
        inner join vmasitems mi on mi.itemid = i.itemid
        inner join tbfacilityreceipts r on r.FACreceiptid=i.FACreceiptid 
        left outer join (
          select  FacilityID,sum(nvl(a.IssueQty,0)) issueQty, 0 AbsRQty,  
        a.Inwno   
        from  tbfacilityoutwards a
        inner join tbfacilityissueitems tbi on tbi.issueitemid =a.issueitemid   
        inner join tbfacilityissues tb on tb.issueid=tbi.issueid    
        where tb.status in ('C','IN')  and tb.FacilityID=:facilityId group by a.Inwno ,FacilityID   
        ) x on x.inwno=rb.inwno and x.FacilityID=r.FacilityID
        where rb.qastatus=1 and   (rb.ExpDate >= SysDate or nvl(rb.ExpDate,SysDate) >= SysDate) and r.status='C' and round(rb.ExpDate-SysDate,0) >= 15 
        and r.FacilityID=:facilityId and (rb.Whissueblock = 0 or rb.Whissueblock is null) group by r.FacilityID,mi.itemid,mi.itemname,mi.itemcode,mi.strength1
        having (sum(nvl(rb.AbsRqty,0))- sum(nvl(x.issueQty,0)) ) > 0  
        Order by mi.itemname 
    `;
    const result = await db.execute(query, { facilityId });
    return result.rows;
}

async function getHeaderInfo(issueId) {
    const query = "Select a.* from tbFacilityIssues a Where a.IssueID=:issueId";
    const result = await db.execute(query, { issueId });
    return result.rows[0];
}

async function getMultiple(itemId) {
    const query = "select Multiple from masitems where itemid=:itemId union select Multiple from lpmasitems where lpitemid=:itemId";
    const result = await db.execute(query, { itemId });
    if (result.rows.length > 0) {
        const row = result.rows[0];
        return Array.isArray(row) ? row[0] : (row.MULTIPLE ?? row.multiple ?? 0);
    }
    return 0;
}

/**
 * getFacilityStock
 * Mirrors C# GetFacilityStock():
 *   - Sums receipt batches (AbsRqty) minus issued quantities
 *   - Only non-expired batches (ExpDate >= SysDate, or null ExpDate treated as today)
 *   - Only QA-passed batches (qastatus = 1)
 *   - Only receipts with status = 'C'
 *   - Excludes batches expiring within 15 days (round(ExpDate-SysDate,0) >= 15)
 *   - Excludes warehouse-blocked batches (Whissueblock = 0 or null)
 *   - Issue outwards counted only where tb.status IN ('C','IN')
 *
 * @param {number|string} facilityId
 * @param {number|string} itemId
 * @returns {number} CurStock (0 if none found)
 */
async function getFacilityStock(facilityId, itemId) {
    const days = 15;
    const query = `
        SELECT
            r.FacilityID,
            i.itemid,
            0                                         AS ReservedQty,
            0                                         AS WardReturnQty,
            SUM(NVL(rb.AbsRqty, 0))                   AS AbsRQty,
            SUM(NVL(x.issueQty, 0))                   AS issueQty,
            SUM(NVL(rb.AbsRqty, 0)) - SUM(NVL(x.issueQty, 0)) AS CurStock
        FROM tbFacilityReceiptBatches rb
        INNER JOIN tbfacilityreceiptitems i
            ON rb.FACreceiptitemid = i.FACreceiptitemid
        INNER JOIN tbfacilityreceipts r
            ON r.FACreceiptid = i.FACreceiptid
        LEFT OUTER JOIN (
            SELECT
                tb.FacilityID,
                SUM(NVL(a.IssueQty, 0)) AS issueQty,
                0                        AS AbsRQty,
                a.Inwno
            FROM tbfacilityoutwards a
            INNER JOIN tbfacilityissueitems tbi
                ON tbi.issueitemid = a.issueitemid
            INNER JOIN tbfacilityissues tb
                ON tb.issueid = tbi.issueid
            WHERE tb.status IN ('C', 'IN')
              AND tb.FacilityID = :facilityId
              AND tbi.itemid    = :itemId
            GROUP BY a.Inwno, tb.FacilityID
        ) x ON x.inwno = rb.inwno AND x.FacilityID = r.FacilityID
        WHERE rb.qastatus = 1
          AND (rb.ExpDate >= SYSDATE OR NVL(rb.ExpDate, SYSDATE) >= SYSDATE)
          AND r.status = 'C'
          AND ROUND(rb.ExpDate - SYSDATE, 0) >= :days
          AND r.FacilityID = :facilityId
          AND i.itemid     = :itemId
          AND (rb.Whissueblock = 0 OR rb.Whissueblock IS NULL)
        GROUP BY r.FacilityID, i.itemid
    `;

    const result = await db.execute(query, { facilityId, itemId, days });

    if (result.rows.length > 0) {
        const row = result.rows[0];
        const curStock = Array.isArray(row)
            ? Number(row[6] ?? 0)          // positional: CurStock is 7th column
            : Number(row.CURSTOCK ?? 0);
        return curStock;
    }
    return 0;
}

async function createHeaderInfo(data) {
    const query = `
        Insert into tbFacilityIssues (FacilityID,IssueNo,IssueDate,WardID,WrequestDate,WRequestBy) 
        values (:facilityId, :issueNo, TO_DATE(:issueDate, 'DD-MM-YYYY'), :wardId, TO_DATE(:requestDate, 'DD-MM-YYYY'), :requestBy) 
        RETURNING IssueID INTO :issueId
    `;
    const binds = {
        facilityId: data.facilityId,
        issueNo: data.issueNo,
        issueDate: data.issueDate,
        wardId: data.wardId,
        requestDate: data.requestDate,
        requestBy: data.requestBy,
        issueId: { dir: require('oracledb').BIND_OUT, type: require('oracledb').NUMBER }
    };
    const result = await db.execute(query, binds, { autoCommit: true });
    return result.outBinds.issueId[0];
}

async function updateHeaderInfo(data) {
    const query = `
        Update tbFacilityIssues 
        set WardID = :wardId, FacilityID=:facilityId, IssueNo=:issueNo, 
            IssueDate=TO_DATE(:issueDate, 'DD-MM-YYYY'), WrequestDate=TO_DATE(:requestDate, 'DD-MM-YYYY'), WRequestBy=:requestBy, Remarks=:remarks 
        Where IssueID=:issueId
    `;
    if (!data.remarks) data.remarks = '';
    const result = await db.execute(query, data, { autoCommit: true });
    return result;
}

async function getIssueItems(issueId, facilityId) {
    const query = `
        Select 0 as SlNo,m1.ItemID,m1.ItemCode,m1.ItemName,
             m1.Strength1 as Strength,m1.Unit as SKU,a.IssueItemID,
            a.IssueQty, cr.CurStock as CurStock,
            a.Allotted,a.Remarks,cr.CurStock as CurBal,
            (cr.CurStock+nvl(a.IssueQty,0))  PrevStock 
        From vmasItems m1       
        Inner join tbFacilityIssueItems a on (a.ItemID=m1.ItemID) 
        Inner join tbFacilityIssues a1 on (a1.IssueID=a.IssueID)
        left outer join
        (
            select  i.itemid, sum(nvl(rb.AbsRqty,0))- sum(nvl(x.issueQty,0)) CurStock
            from tbFacilityReceiptBatches rb  
            inner join tbfacilityreceiptitems i on rb.FACreceiptitemid=i.FACreceiptitemid  
            inner join tbfacilityreceipts r on r.FACreceiptid=i.FACreceiptid 
            left outer join (
                select  FacilityID,sum(nvl(a.IssueQty,0)) issueQty, 0 AbsRQty, a.Inwno   
                from  tbfacilityoutwards a
                inner join tbfacilityissueitems tbi on tbi.issueitemid =a.issueitemid   
                inner join tbfacilityissues tb on tb.issueid=tbi.issueid    
                where tb.FacilityID=:facilityId 
                and tbi.itemid in (select distinct itemid from tbfacilityissueitems where IssueID = :issueId) 
                group by a.Inwno ,FacilityID   
            ) x on x.inwno=rb.inwno and x.FacilityID=r.FacilityID
            where (rb.ExpDate >= SysDate or nvl(rb.ExpDate,SysDate) >= SysDate) 
            and r.status='C' and r.FacilityID=:facilityId  and i.itemid in (select distinct itemid from tbfacilityissueitems where IssueID = :issueId)
            group by i.itemid
        ) cr on cr.itemid=a.itemid
        Where a.IssueID = :issueId Order by a.IssueItemid
    `;
    const oracledb = require('oracledb');
    const result = await db.execute(query, { issueId, facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows;
}

async function checkDuplicateItem(issueId, itemId) {
    const query = "select count(1) as cnt from tbFacilityIssueItems where IssueID = :issueId and ItemID = :itemId";
    const result = await db.execute(query, { issueId, itemId });
    return result.rows[0].CNT > 0;
}

async function addIssueItem(data) {
    const query = `
        Insert into tbFacilityIssueItems (IssueID,ItemID,CurrentStock,Allotted,IssueQty) 
        values(:issueId, :itemId, :curStock, :allotted, :issueQty)
        RETURNING IssueItemID INTO :issueItemId
    `;
    const binds = {
        issueId: data.issueId,
        itemId: data.itemId,
        curStock: data.curStock,
        allotted: data.allotted,
        issueQty: data.issueQty,
        issueItemId: { dir: require('oracledb').BIND_OUT, type: require('oracledb').NUMBER }
    };
    const result = await db.execute(query, binds, { autoCommit: true });
    return result.outBinds.issueItemId[0];
}

async function updateIssueItem(data) {
    const query = `
        Update tbFacilityIssueItems 
        set IssueID=:issueId, ItemID=:itemId, CurrentStock=:curStock, Allotted=:allotted, IssueQty=:issueQty 
        where IssueItemID=:issueItemId
    `;
    await db.execute(query, data, { autoCommit: true });
}

async function deleteIssueItem(issueItemId) {
    const deleteOutwards = "Delete from tbFacilityOutwards where IssueItemID = :issueItemId";
    await db.execute(deleteOutwards, { issueItemId }, { autoCommit: true });

    const query = "Delete from tbFacilityIssueItems where IssueItemID = :issueItemId";
    await db.execute(query, { issueItemId }, { autoCommit: true });
}

async function completeIssue(issueId) {
    const query = "update tbFacilityIssues set status='C' where IssueID = :issueId";
    await db.execute(query, { issueId }, { autoCommit: true });
}

async function deleteIssue(issueId) {
    const deleteOutwards = `
        DELETE FROM tbFacilityOutwards 
        WHERE IssueItemID IN (SELECT IssueItemID FROM tbFacilityIssueItems WHERE IssueID = :issueId)
    `;
    await db.execute(deleteOutwards, { issueId }, { autoCommit: true });

    const deleteItems = "DELETE FROM tbFacilityIssueItems WHERE IssueID = :issueId";
    await db.execute(deleteItems, { issueId }, { autoCommit: true });

    const query = "Delete from tbFacilityIssues where IssueID = :issueId";
    await db.execute(query, { issueId }, { autoCommit: true });
}

/**
 * getMasItems — fetches all items from masItems table
 * Returns rows: [ { ITEMID, ITEMNAME } ]
 * where ITEMNAME is formatted as "CODE - (Name)"
 */
async function getMasItems() {
    const query = `
        SELECT ItemID,
               ItemCode || ' - (' || ItemName || ')' AS ItemName
        FROM masItems
        WHERE 1 = 1
        ORDER BY ItemName
    `;

    const result = await db.execute(query, {});
    return result.rows;
}

async function updateFacilityAllotQtyOP(facilityId, itemId, issueQty, issueItemId) {
    // 1. Delete any existing tbFacilityOutwards rows for the current IssueItemID
    const deleteQuery = "Delete from tbFacilityOutwards Where IssueItemID = :issueItemId";
    await db.execute(deleteQuery, { issueItemId }, { autoCommit: true });

    if (issueQty <= 0) {
        return;
    }

    // 2. Query available receipt batches for the item in expiry order
    const batchQuery = `
        select distinct rb.FACReceiptItemid FacReceiptItemID,
                        rb.BatchNo,
                        rb.MfgDate,
                        rb.ExpDate,
                        nvl(rb.AbsRqty,0) AbsRQty,
                        nvl(x.issueQty,0) AllotQty,
                        nvl(rb.AbsRqty,0)-nvl(x.issueQty,0) avlQty,
                        rb.Inwno,
                        rb.whinwno
        from tbFacilityReceiptBatches rb
        inner join tbfacilityreceiptitems i on rb.FACreceiptitemid=i.FACreceiptitemid
        inner join tbfacilityreceipts r on r.FACreceiptid=i.FACreceiptid
        left outer join (
            select '' BatchNo,'' MfgDate,'' ExpDate,
                   sum(nvl(a.IssueQty,0)) issueQty,
                   0 AbsRQty,
                   a.Inwno
            from tbfacilityoutwards a
            inner join tbfacilityissueitems tbi on tbi.issueitemid = a.issueitemid
            inner join tbfacilityissues tb on tb.issueid = tbi.issueid
            Where tb.FacilityID = :facilityId
              and tbi.itemid = :itemId
            group by a.Inwno, FacilityID
        ) x on x.inwno = rb.inwno
        where rb.qastatus=1
          and r.status='C'
          and nvl(rb.whissueblock,0) in (0)
          and r.FacilityID = :facilityId
          and i.ItemID = :itemId
          and (rb.ExpDate >= SysDate or nvl(rb.ExpDate,SysDate) >= SysDate)
          and (nvl(rb.AbsRqty,0) - nvl(x.issueQty,0)) > 0
          and Round(rb.ExpDate - sysdate,0) >= 15
        order by expdate
    `;

    const result = await db.execute(batchQuery, { facilityId, itemId });

    let remainingQty = Number(issueQty);

    // 3. Allocate requested quantity from the earliest expiry batches
    for (const row of result.rows) {
        const facReceiptItemId = Array.isArray(row) ? row[0] : (row.FACRECEIPTITEMID ?? row.facReceiptItemId);
        const avlQty = Array.isArray(row) ? Number(row[6] ?? 0) : Number(row.AVLQTY ?? row.avlQty ?? 0);
        const inwNo = Array.isArray(row) ? row[7] : (row.INWNO ?? row.inwNo);
        const whInwNo = Array.isArray(row) ? row[8] : (row.WHINWNO ?? row.whinwno ?? row.whInwNo);

        if (avlQty <= 0) continue;

        const allot = Math.min(remainingQty, avlQty);
        if (allot > 0) {
            // 4. Insert allocation row into tbFacilityOutwards
            const insertQuery = `
                Insert into tbFacilityOutwards
                (IssueItemID, ItemID, FacReceiptItemID, IssueQty, Issued, Inwno)
                values (:issueItemId, :itemId, :facReceiptItemId, :issueQty, 0, :inwNo)
            `;
            await db.execute(insertQuery, {
                issueItemId,
                itemId,
                facReceiptItemId,
                issueQty: allot,
                inwNo
            }, { autoCommit: true });

            remainingQty -= allot;
            if (remainingQty <= 0) {
                break;
            }
        }
    }
}

async function getIncompleteIssue(facilityId) {
    const query = `
        SELECT t.IssueID, t.IssueNo, t.WardID, t.IssueDate, t.WRequestDate, t.WRequestBy, t.Status, w.WardName
        FROM tbFacilityIssues t
        LEFT JOIN masFacilityWards w ON t.WardID = w.WardID
        WHERE t.FacilityID = :facilityId
          AND NVL(t.Status, 'IN') = 'IN'
          AND t.IssueType = 'NO'
          AND ROWNUM = 1
    `;
    const result = await db.execute(query, { facilityId });
    if (result.rows.length > 0) {
        const row = result.rows[0];
        return Array.isArray(row) ? {
            IssueID: row[0],
            IssueNo: row[1],
            WardID: row[2],
            IssueDate: row[3],
            WRequestDate: row[4],
            WRequestBy: row[5],
            Status: row[6],
            WardName: row[7]
        } : {
            IssueID: row.ISSUEID || row.issueId,
            IssueNo: row.ISSUENO || row.issueNo,
            WardID: row.WARDID || row.wardId,
            IssueDate: row.ISSUEDATE || row.issueDate,
            WRequestDate: row.WREQUESTDATE || row.wrequestDate,
            WRequestBy: row.WREQUESTBY || row.wrequestBy,
            Status: row.STATUS || row.status,
            WardName: row.WARDNAME || row.wardName
        };
    }
    return null;
}

module.exports = {
    getWards,
    generateIssueNo,
    getItems,
    getMasItems,
    getHeaderInfo,
    getMultiple,
    getFacilityStock,
    createHeaderInfo,
    updateHeaderInfo,
    getIssueItems,
    checkDuplicateItem,
    addIssueItem,
    updateIssueItem,
    deleteIssueItem,
    completeIssue,
    deleteIssue,
    updateFacilityAllotQtyOP,
    getIncompleteIssue
};

async function checkOpeningStockReceipt(facilityId) {
    const query = `
        SELECT a.facreceiptid
        FROM tbfacilityreceipts a, masfacilities b
        WHERE a.facilityid=b.facilityid
          AND a.facilityid is not null
          AND FACReceiptType='FC'
          AND a.facilityid = :facilityId
    `;
    const result = await db.execute(query, { facilityId });
    return result.rows.length > 0;
}

async function getAccYears() {
    const query = `
        SELECT AccYrSetID, SHAccYear
        FROM masAccYearSettings
        where sysdate >= STARTDATE
        ORDER BY StartDate DESC

    `;
    const result = await db.execute(query, {});
    return result.rows;
}

async function getWardIssuesList(facilityId, status, accYrSetId, itemId) {
    let filterCondition = "";
    const binds = { facilityId };

    if (status === 'IR') {
        filterCondition += " AND NVL(a.Status, 'IN') = 'IN'";
    } else if (status === 'CR') {
        filterCondition += " AND NVL(a.Status, 'IN') = 'C'";
    }

    if (accYrSetId) {
        filterCondition += " AND m1.AccYrSetID = :accYrSetId";
        binds.accYrSetId = accYrSetId;
    }

    if (itemId) {
        filterCondition += " AND a.IssueID IN (Select IssueID from tbFacilityIssueItems Where IssueID=a.IssueID and ItemID = :itemId)";
        binds.itemId = itemId;
    }

    const query = `
        Select 
            a.WardID,
            b.WardCode,
            b.WardName,
            c.StateName,
            fac.FacilityName,
            d.DistrictName,
            a.IssueNo,
            a.IssueDate,
            a.WRequestDate,
            a.WRequestBy,
            NVL(a.Status, 'IN') as Status,
            a.IssueID
        from tbFacilityIssues a
        Inner Join masFacilityWards b on (b.WardID=a.WardID)
        Inner Join masFacilities fac on (fac.FacilityID=b.FacilityID)
        Inner Join masStates c on (c.StateID=fac.StateID)
        Inner Join masDistricts d on (d.StateID=c.StateID and d.DistrictID=fac.DistrictID)
        Inner Join masAccYearSettings m1 on (a.IssueDate Between m1.StartDate and m1.EndDate)
        Where a.FacilityID = :facilityId 
          AND a.IssueType = 'NO'
          ${filterCondition}
        Order By a.IssueDate DESC
    `;
    const result = await db.execute(query, binds);
    return result.rows;
}

async function getReturnsWards(facilityId) {
    const wardsQuery = `
        Select 
               m1.WardID,
               m1.WardCode,
               m1.WardName
        from masFacilityWards m1
        Where m1.IsActive=1 and m1.FacilityID=:facilityId
        Order By m1.WardName
    `;
    const wardsResult = await db.execute(wardsQuery, { facilityId });
    const wards = wardsResult.rows;

    const issuesQuery = `
        Select distinct WardID
        from tbFacilityIssues
        where FacilityID=:facilityId
    `;
    const issuesResult = await db.execute(issuesQuery, { facilityId });
    const issueWardIds = new Set(issuesResult.rows.map(r => String(Array.isArray(r) ? r[0] : (r.WARDID ?? r.wardId))));

    return wards.map(w => {
        const wardId = String(Array.isArray(w) ? w[0] : (w.WARDID ?? w.wardId));
        const wardName = Array.isArray(w) ? w[2] : (w.WARDNAME ?? w.wardName);
        const wardCode = Array.isArray(w) ? w[1] : (w.WARDCODE ?? w.wardCode);
        return {
            WardID: wardId,
            WardCode: wardCode,
            WardName: wardName,
            hasIssues: issueWardIds.has(wardId)
        };
    });
}

async function getReturnsReceiptsList(facilityId, wardId, status, accYrSetId, itemId) {
    let filterCondition = "";
    const binds = { facilityId, wardId };

    if (status === 'IR') {
        filterCondition += " AND NVL(a1.Status, 'IN') = 'IN'";
    } else if (status === 'CR') {
        filterCondition += " AND NVL(a1.Status, 'IN') = 'C'";
    }

    if (accYrSetId) {
        filterCondition += " AND m1.AccYrSetID = :accYrSetId";
        binds.accYrSetId = accYrSetId;
    }

    if (itemId) {
        filterCondition += " AND a1.FacReceiptID in (Select FacReceiptID from tbFacilityReceiptItems Where FacReceiptID=a1.FacReceiptID and ItemID=:itemId)";
        binds.itemId = itemId;
    }

    const query = `
        Select 
               a1.FacReceiptID,
               a1.FacReceiptNo,
               a1.FacReceiptDate,
               NVL(a1.Status, 'IN') as Status,
               'FAC' as Source
        from tbFacilityReceipts a1
        Inner Join masAccYearSettings m1 on (a1.FacReceiptDate between m1.StartDate and m1.EndDate)
        Where a1.WardID = :wardId 
          AND a1.FacilityID = :facilityId
          AND a1.FacReceiptType = 'RW'
          ${filterCondition}
        Union
        Select 
               a1.ReceiptID as FacReceiptID,
               a1.ReceiptNo as FacReceiptNo,
               a1.ReceiptDate as FacReceiptDate,
               NVL(a1.Status, 'IN') as Status,
               'LPTB' as Source
        from lptbReceipts a1
        Where a1.WardID = :wardId 
          AND a1.FacilityID = :facilityId 
          AND a1.ReceiptType = 'RW'
        Order By FacReceiptDate DESC
    `;
    const result = await db.execute(query, binds);
    return result.rows;
}

module.exports.checkOpeningStockReceipt = checkOpeningStockReceipt;
module.exports.getAccYears = getAccYears;
module.exports.getWardIssuesList = getWardIssuesList;
module.exports.getReturnsWards = getReturnsWards;
module.exports.getReturnsReceiptsList = getReturnsReceiptsList;

async function getPrintDetails(issueId, facilityId) {
    const db = require('../config/db');
    // 1. Get header info
    const headerQuery = `
        Select 
            a.IssueID,
            a.IssueNo,
            a.IssueDate,
            a.WRequestDate,
            a.WRequestBy,
            a.Remarks,
            NVL(a.Status, 'IN') as Status,
            COALESCE(b.WardName, toFac.FacilityName) as WardName,
            COALESCE(b.WardCode, toFac.FacilityCode) as WardCode,
            fac.FacilityName,
            d.DistrictName,
            c.StateName
        from tbFacilityIssues a
        LEFT Join masFacilityWards b on (b.WardID=a.WardID)
        LEFT Join masFacilities toFac on (toFac.FacilityID=a.ToFacilityID)
        Inner Join masFacilities fac on (fac.FacilityID=a.FacilityID)
        Inner Join masStates c on (c.StateID=fac.StateID)
        Inner Join masDistricts d on (d.StateID=c.StateID and d.DistrictID=fac.DistrictID)
        Where a.IssueID = :issueId and a.FacilityID = :facilityId
    `;
    const headerResult = await db.execute(headerQuery, { issueId, facilityId });
    if (headerResult.rows.length === 0) return null;
    const header = headerResult.rows[0];

    // 2. Get items
    const itemsQuery = `
        Select 
            a.IssueItemID,
            a.ItemID,
            m1.ItemCode,
            m1.ItemName,
            m1.Strength1 as Strength,
            m1.Unit as SKU,
            a.IssueQty,
            a.Allotted,
            a.CurrentStock
        From tbFacilityIssueItems a
        Inner join vmasItems m1 on (a.ItemID=m1.ItemID)
        Where a.IssueID = :issueId
        Order by a.IssueItemID
    `;
    const itemsResult = await db.execute(itemsQuery, { issueId });
    const items = itemsResult.rows;

    // 3. Get allocated batches for each item
    const itemsWithBatches = [];
    for (const item of items) {
        const itemObj = Array.isArray(item) ? {
            IssueItemID: item[0],
            ItemID: item[1],
            ItemCode: item[2],
            ItemName: item[3],
            Strength: item[4],
            SKU: item[5],
            IssueQty: item[6],
            Allotted: item[7],
            CurrentStock: item[8]
        } : {
            IssueItemID: item.ISSUEITEMID || item.issueItemId,
            ItemID: item.ITEMID || item.itemId,
            ItemCode: item.ITEMCODE || item.itemCode,
            ItemName: item.ITEMNAME || item.itemName,
            Strength: item.STRENGTH || item.strength,
            SKU: item.SKU || item.sku,
            IssueQty: item.ISSUEQTY || item.issueQty,
            Allotted: item.ALLOTTED || item.allotted,
            CurrentStock: item.CURRENTSTOCK || item.currentStock
        };

        const batchesQuery = `
            SELECT
                rb.BatchNo,
                rb.MfgDate,
                rb.ExpDate,
                NVL(a.IssueQty,0) IssueQty,
                NVL(mr.locationno,'0') StockLocation
            FROM tbfacilityoutwards a
            INNER JOIN tbFacilityReceiptBatches rb
                ON rb.inwno = a.inwno
                AND rb.facreceiptitemid = a.facreceiptitemid
            LEFT JOIN masracks mr
                ON mr.rackid = rb.StockLocation
            WHERE a.IssueItemID = :issueItemId
            ORDER BY rb.expdate
        `;
        const batchesResult = await db.execute(batchesQuery, { issueItemId: itemObj.IssueItemID });
        itemObj.batches = batchesResult.rows.map(b => {
            return Array.isArray(b) ? {
                BatchNo: b[0],
                MfgDate: b[1],
                ExpDate: b[2],
                IssueQty: b[3],
                StockLocation: b[4]
            } : {
                BatchNo: b.BATCHNO || b.batchNo,
                MfgDate: b.MFGDATE || b.mfgDate,
                ExpDate: b.EXPDATE || b.expDate,
                IssueQty: b.ISSUEQTY || b.issueQty,
                StockLocation: b.STOCKLOCATION || b.stockLocation
            };
        });

        itemsWithBatches.push(itemObj);
    }

    const headerObj = Array.isArray(header) ? {
        IssueID: header[0],
        IssueNo: header[1],
        IssueDate: header[2],
        WRequestDate: header[3],
        WRequestBy: header[4],
        Remarks: header[5],
        Status: header[6],
        WardName: header[7],
        WardCode: header[8],
        FacilityName: header[9],
        DistrictName: header[10],
        StateName: header[11]
    } : {
        IssueID: header.ISSUEID || header.issueId,
        IssueNo: header.ISSUENO || header.issueNo,
        IssueDate: header.ISSUEDATE || header.issueDate,
        WRequestDate: header.WREQUESTDATE || header.wrequestDate,
        WRequestBy: header.WREQUESTBY || header.wrequestBy,
        Remarks: header.REMARKS || header.remarks,
        Status: header.STATUS || header.status,
        WardName: header.WARDNAME || header.wardName,
        WardCode: header.WARDCODE || header.wardCode,
        FacilityName: header.FACILITYNAME || header.facilityName,
        DistrictName: header.DISTRICTNAME || header.districtName,
        StateName: header.STATENAME || header.stateName
    };

    return {
        header: headerObj,
        items: itemsWithBatches
    };
}

module.exports.getPrintDetails = getPrintDetails;

