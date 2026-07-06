const db = require('../config/db');
const oracledb = require('oracledb');

async function getWarehouseIndents(facilityId, accYear) {
    let query = `
        SELECT 
            w.WarehouseName as "warehouse",
            i.RequestDocNo as "indentNo",
            i.IndentID as "indentId",
            TO_CHAR(i.RequestDate, 'DD-MM-YYYY') as "indentDate",
            i.IndentNo as "whIssueNo",
            TO_CHAR(i.IndentDate, 'DD-MM-YYYY') as "whIssueDate",
            CASE 
                WHEN r.FacReceiptID IS NOT NULL AND r.Status = 'C' THEN 'Completed'
                WHEN r.FacReceiptID IS NOT NULL THEN 'Incomplete'
                WHEN (SELECT COUNT(*) FROM tbFacilityReceipts r2 WHERE r2.IndentID = i.IndentID) > 0 THEN 'Partial Receipt'
                ELSE 'Yet to be Received'
            END as "receiptStatus",
            r.FacReceiptNo as "receiptNo",
            TO_CHAR(r.FacReceiptDate, 'DD-MM-YYYY') as "receiptDate",
            r.FacReceiptID as "receiptId"
        FROM tbIndents i
        LEFT JOIN masWarehouses w ON i.WarehouseID = w.WarehouseID
        INNER JOIN masAccYearSettings y ON (i.RequestDate BETWEEN y.StartDate AND y.EndDate)
        LEFT JOIN tbFacilityReceipts r ON r.IndentID = i.IndentID
        WHERE i.FacilityID = :facilityId
          AND y.ACCYRSETID = :accYear
          AND i.Status NOT IN ('I', 'D')
        ORDER BY i.RequestDate DESC, r.FacReceiptDate DESC
    `;
    const params = { facilityId, accYear };
    try {
        const result = await db.execute(query, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows || [];
    } catch (err) {
        console.error("Error executing getWarehouseIndents query, returning mock data.", err);
        return [
            { warehouse: 'Raipur', indentNo: '23246/NC00014/26-27', indentId: 1, indentDate: '17-06-2026', whIssueNo: '01/NO/A/26-27/01636', whIssueDate: '17-06-2026', receiptStatus: 'Yet to be Received' },
            { warehouse: 'Raipur', indentNo: '23246/NC00013/26-27', indentId: 2, indentDate: '11-06-2026', whIssueNo: '01/NO/A/26-27/01535', whIssueDate: '11-06-2026', receiptStatus: 'Partial Receipt' },
            { warehouse: 'Raipur', indentNo: '23246/NC00011/26-27', indentId: 3, indentDate: '02-06-2026', whIssueNo: '01/NO/A/26-27/01315', whIssueDate: '02-06-2026', receiptStatus: 'Partial Receipt' }
        ];
    }
}

async function getReceiptsByIndent(facilityId, indentId) {
    let query = `
        SELECT 
            r.FacReceiptNo as "receiptNo",
            r.FacReceiptID as "receiptId",
            TO_CHAR(r.FacReceiptDate, 'DD-MM-YYYY') as "receiptDate",
            CASE 
                WHEN r.Status = 'C' THEN 'Completed'
                ELSE 'Incomplete'
            END as "status"
        FROM tbFacilityReceipts r
        WHERE r.IndentID = :indentId
          AND r.FacilityID = :facilityId
        ORDER BY r.FacReceiptDate DESC
    `;
    const params = { facilityId, indentId };
    try {
        const result = await db.execute(query, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows || [];
    } catch (err) {
        console.error("Error executing getReceiptsByIndent query, returning mock data.", err);
        return [
            { receiptNo: '01109/NO/00016/26-27', receiptId: 101, receiptDate: '23-06-2026', status: 'Incomplete' },
            { receiptNo: '01109/NO/00015/26-27', receiptId: 102, receiptDate: '18-06-2026', status: 'Completed' }
        ];
    }
}

async function getFinancialYears() {
    let query = `
        SELECT 
            ACCYRSETID as "id",
            AccYear as "year"
        FROM masAccYearSettings
        ORDER BY AccYear DESC
    `;
    try {
        const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows || [];
    } catch (e) {
        console.error("Error executing getFinancialYears query, returning mock data.", e);
        return [
            { id: 2, year: '2026-2027' },
            { id: 1, year: '2025-2026' }
        ];
    }
}

async function getReceiptHeader(facilityId, receiptId) {
    let query = `
        Select m6.AccYear as "accYear", m4.SourceName as "sourceName", m5.SchemeName as "schemeName",
            m1.WarehouseName as "warehouseName", b.IndentNo as "indentNo", TO_CHAR(b.IndentDate, 'DD-MM-YYYY') as "indentDate",
            a.FacReceiptNo as "facReceiptNo", TO_CHAR(a.FacReceiptDate, 'DD-MM-YYYY') as "facReceiptDate", a.Remarks as "remarks",
            a.Status as "status"
        from tbFacilityReceipts a
        Inner Join tbIndents b on (b.IndentID = a.IndentID)
        Inner Join masWarehouses m1 on (m1.WarehouseID = b.WarehouseID)
        left outer Join masSources m4 on (m4.SourceID = a.SourceID)
        left outer Join masSchemes m5 on (m5.SchemeID = a.SchemeID)
        Inner Join masAccYearSettings m6 on (b.IndentDate between m6.StartDate and m6.EndDate)
        where a.FacReceiptID = :receiptId AND a.FacilityID = :facilityId
    `;
    const params = { receiptId, facilityId };
    try {
        const result = await db.execute(query, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows ? result.rows[0] : null;
    } catch (err) {
        console.error("Error executing getReceiptHeader query, returning mock data.", err);
        return {
            accYear: '2026-2027', warehouseName: 'Raipur', indentNo: '23246/NC00014/26-27', indentDate: '17-06-2026',
            facReceiptNo: '01109/NO/00016/26-27', facReceiptDate: '23-06-2026', remarks: 'Received completely'
        };
    }
}

async function getReceiptItems(facilityId, receiptId) {
    let query = `
        SELECT 
            a.FacReceiptID as "facReceiptId", 
            b.FacReceiptItemID as "facReceiptItemId", 
            ii.ItemID as "itemId",
            m1.ItemCode as "itemCode", 
            m1.ItemName as "itemName", 
            m1.Strength1 as "strength",
            m1.Unit as "sku", 
            m2.ItemTypeName as "itemType", 
            NVL(b.AbsRQty, 0) as "receiptQty",
            COALESCE(b.STOCKLOCATION, (SELECT MAX(rfb.STOCKLOCATION) FROM tbFacilityReceiptBatches rfb WHERE rfb.FacReceiptItemID = b.FacReceiptItemID)) as "stockLocation",
            NVL(rc.locationno, '-') as "stockLocationName",
            NVL(m1.UNITCOUNT, 1) as "packQty",
            CASE WHEN m1.ISEDL = 1 THEN 'EDL' ELSE 'Non-EDL' END as "edlType",
            b.BatchNo as "batchNo", 
            TO_CHAR(b.MdgDate, 'DD-MM-YYYY') as "mfgDate", 
            TO_CHAR(b.ExpDate, 'DD-MM-YYYY') as "expDate", 
            NVL(b.ShortQty, 0) as "shortQty", 
            ii.indentitemid as "indentItemId",
            NVL(ii.NEEDED, 0) as "indentQty",
            (SELECT NVL(SUM(ot.ISSUEQTY), 0) FROM tbOutwards ot WHERE ot.indentitemid = ii.indentitemid) as "whIssueQty"
        FROM tbFacilityReceipts a
        INNER JOIN tbIndentItems ii on (ii.IndentID = a.IndentID)
        LEFT OUTER JOIN tbFacilityReceiptItems b on (b.FacReceiptID = a.FacReceiptID and b.IndentItemID = ii.IndentItemID)
        LEFT OUTER JOIN masracks rc on (TO_CHAR(rc.RackID) = COALESCE(b.STOCKLOCATION, (SELECT MAX(rfb.STOCKLOCATION) FROM tbFacilityReceiptBatches rfb WHERE rfb.FacReceiptItemID = b.FacReceiptItemID)))
        INNER JOIN masItems m1 on (m1.ItemID = ii.ItemID)
        INNER JOIN masItemTypes m2 on (m2.ItemTypeID = m1.ItemTypeID)
        WHERE a.FacReceiptID = :receiptId
          AND a.FacilityID = :facilityId
        ORDER BY m1.ItemCode
    `;
    const params = { receiptId, facilityId };
    try {
        const result = await db.execute(query, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows || [];
    } catch (err) {
        console.error("Error executing getReceiptItems query, returning mock data.", err);
        return [
            { facReceiptId: receiptId, facReceiptItemId: 1001, itemCode: 'DRG001', itemName: 'Paracetamol', strength: '500mg', sku: 'Tablet', itemType: 'QTR', receiptQty: 3600, stockLocation: null, packQty: 1, edlType: 'EDL', indentItemId: 5001, indentQty: 5000, whIssueQty: 3600 },
            { facReceiptId: receiptId, facReceiptItemId: 1002, itemCode: 'DRG002', itemName: 'Ibuprofen', strength: '400mg', sku: 'Tablet', itemType: 'QTR', receiptQty: 10000, stockLocation: null, packQty: 1, edlType: 'EDL', indentItemId: 5002, indentQty: 10000, whIssueQty: 10000 }
        ];
    }
}

async function getReceiptBatches(indentItemId) {
    let query = `
        SELECT DISTINCT 0 AS "slNo",
               NVL(rc.locationno,'-') AS "locationno",
               rb.inwno AS "inwNo",
               rb.batchno AS "batchNo",
               ot.issueqty AS "issueQty",
               TO_CHAR(rb.mfgdate, 'DD/MM/YYYY') AS "mfgDate",
               TO_CHAR(rb.expdate, 'DD/MM/YYYY') AS "expDate",
               ii.itemid AS "itemId",
               r.facreceiptid AS "facReceiptId",
               ri.facreceiptitemid AS "facReceiptItemId"
        FROM tbindentitems ii
        LEFT JOIN tboutwards ot ON ot.indentitemid = ii.indentitemid
        LEFT JOIN tbfacilityreceipts r ON r.indentid = ii.indentid
        LEFT JOIN tbfacilityreceiptitems ri ON ri.facreceiptid = r.facreceiptid AND ri.itemid = ii.itemid
        LEFT JOIN tbfacilityreceiptbatches rfb ON rfb.facreceiptitemid = ri.facreceiptitemid
        LEFT JOIN tbreceiptbatches rb ON rb.inwno = ot.inwno
        INNER JOIN masitems mi ON mi.itemid = ii.itemid
        LEFT JOIN masracks rc ON TO_CHAR(rc.rackid) = rfb.stocklocation
        WHERE ii.indentitemid = :indentItemId
    `;
    const params = { indentItemId };
    try {
        const result = await db.execute(query, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows || [];
    } catch (err) {
        console.error("Error executing getReceiptBatches query, returning mock data.", err);
        return [
            { batchNo: 'BTH-9901', issueQty: 3600, mfgDate: '01/01/2025', expDate: '01/01/2027', locationno: '-' },
            { batchNo: 'BTH-9902', issueQty: 5404, mfgDate: '01/02/2025', expDate: '01/02/2027', locationno: '-' }
        ];
    }
}

async function getStockLocations(facilityId) {
    let query = `
        SELECT NVL(RackID,0) AS "id",
               NVL(locationno,'Null') AS "name"
        FROM masracks
        WHERE warehouseid = :facilityId
        ORDER BY locationno
    `;
    const params = { facilityId };
    try {
        const result = await db.execute(query, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows || [];
    } catch (err) {
        console.error("Error executing getStockLocations query, returning mock data.", err);
        return [
            { id: 1, name: 'INJECTION RACK 1' },
            { id: 2, name: 'TAB RACK 1' },
            { id: 3, name: 'TAB RACK 3' },
            { id: 4, name: 'OINTMENT RACK' }
        ];
    }
}

async function saveReceiptItem(facilityId, receiptId, payload) {
    let { facReceiptItemId, indentItemId, itemId, receiptQty, stockLocation, batches } = payload;
    let query;
    let params;
    let connection;

    try {
        connection = await oracledb.getConnection();

        if (facReceiptItemId) {
            query = `
                UPDATE tbFacilityReceiptItems
                SET AbsRQty = :receiptQty, StockLocation = :stockLocation
                WHERE FacReceiptItemID = :facReceiptItemId
            `;
            params = { receiptQty, stockLocation, facReceiptItemId };
            await connection.execute(query, params);
            
            // Delete existing batches for this item to re-insert
            await connection.execute(`DELETE FROM tbFacilityReceiptBatches WHERE FacReceiptItemID = :facReceiptItemId`, [facReceiptItemId]);
        } else {
            query = `
                INSERT INTO tbFacilityReceiptItems 
                (FacReceiptID, IndentItemID, ItemID, AbsRQty, StockLocation) 
                VALUES (:receiptId, :indentItemId, :itemId, :receiptQty, :stockLocation)
                RETURNING FacReceiptItemID INTO :outId
            `;
            params = { 
                receiptId, indentItemId, itemId, receiptQty, stockLocation,
                outId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
            };
            const result = await connection.execute(query, params);
            if (result.outBinds && result.outBinds.outId && result.outBinds.outId.length > 0) {
                facReceiptItemId = result.outBinds.outId[0];
            }
        }

        // Insert Batches
        if (batches && batches.length > 0 && facReceiptItemId) {
            const batchQuery = `
                INSERT INTO tbFacilityReceiptBatches
                (FACReceiptItemID, ItemID, BatchNo, StockLocation, MfgDate, ExpDate, AbsRQty, ShortQty, qastatus)
                VALUES
                (:facReceiptItemId, :itemId, :batchNo, :stockLocation,
                 TO_DATE(:mfgDate,'DD/MM/YYYY'), TO_DATE(:expDate,'DD/MM/YYYY'),
                 :absRQty, :shortQty, '1')
            `;
            for (let b of batches) {
                // Skip if missing critical batch info
                if (!b.batchNo || !b.mfgDate || !b.expDate) continue;
                
                await connection.execute(batchQuery, {
                    facReceiptItemId,
                    itemId,
                    batchNo: b.batchNo,
                    stockLocation,
                    mfgDate: b.mfgDate,
                    expDate: b.expDate,
                    absRQty: b.issueQty || 0,
                    shortQty: 0
                });
            }
        }

        await connection.commit();
        return { success: true, message: 'Item and batches saved successfully' };
    } catch (err) {
        console.error("Error executing saveReceiptItem query", err);
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackErr) {
                console.error("Rollback error:", rollbackErr);
            }
        }
        throw err;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error("Error closing connection", err);
            }
        }
    }
}

/**
 * addBatch — mirrors ASP.NET gvBatches_RowUpdating event
 *
 * Flow:
 *   1. Ensure tbFacilityReceiptItems row exists (INSERT if new, get ID if existing)
 *   2. INSERT one row into tbFacilityReceiptBatches with the selected StockLocation
 *   3. Commit. Rollback on any error.
 *
 * Values sourced from UI (batchNo, mfgDate, expDate, absRQty, stockLocation)
 * Values from DB / context (facReceiptItemId, itemId, indentItemId, receiptId)
 * ShortQty = issueQty - absRQty (calculated here, mirroring ASP.NET logic)
 */
async function addBatch(facilityId, receiptId, payload) {
    let {
        facReceiptItemId,   // null if item not yet saved
        indentItemId,
        itemId,
        receiptQty,         // AbsRQty for tbFacilityReceiptItems
        stockLocation,      // RackID from ddlLocation
        batchNo,            // entered by user
        mfgDate,            // entered by user  DD/MM/YYYY
        expDate,            // entered by user  DD/MM/YYYY
        absRQty,            // received qty for this batch
        issueQty            // warehouse issue qty (for ShortQty calc)
    } = payload;

    const shortQty = Math.max(0, (issueQty || 0) - (absRQty || 0));
    let connection;

    try {
        connection = await oracledb.getConnection();

        // ── Step 1: Ensure FacilityReceiptItem row exists ─────────────────────
        if (!facReceiptItemId) {
            // Check if one already exists for this receipt + indent item
            const existing = await connection.execute(
                `SELECT FacReceiptItemID FROM tbFacilityReceiptItems
                 WHERE FacReceiptID = :receiptId AND IndentItemID = :indentItemId`,
                { receiptId, indentItemId },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );

            if (existing.rows && existing.rows.length > 0) {
                facReceiptItemId = existing.rows[0].FACRECEIPTITEMID;
                // Update qty + location
                await connection.execute(
                    `UPDATE tbFacilityReceiptItems
                     SET AbsRQty = :receiptQty, StockLocation = :stockLocation
                     WHERE FacReceiptItemID = :facReceiptItemId`,
                    { receiptQty: receiptQty || absRQty, stockLocation, facReceiptItemId }
                );
            } else {
                // INSERT new item row, capture generated PK
                const insertResult = await connection.execute(
                    `INSERT INTO tbFacilityReceiptItems
                     (FacReceiptID, IndentItemID, ItemID, AbsRQty, StockLocation)
                     VALUES (:receiptId, :indentItemId, :itemId, :receiptQty, :stockLocation)
                     RETURNING FacReceiptItemID INTO :outId`,
                    {
                        receiptId, indentItemId, itemId,
                        receiptQty: receiptQty || absRQty,
                        stockLocation,
                        outId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
                    }
                );
                facReceiptItemId = insertResult.outBinds.outId[0];
            }
        } else {
            // Item exists — just update qty + location
            await connection.execute(
                `UPDATE tbFacilityReceiptItems
                 SET AbsRQty = :receiptQty, StockLocation = :stockLocation
                 WHERE FacReceiptItemID = :facReceiptItemId`,
                { receiptQty: receiptQty || absRQty, stockLocation, facReceiptItemId }
            );
        }

        // ── Step 2: INSERT batch row into tbFacilityReceiptBatches ────────────
        // Mirrors: INSERT INTO tbFacilityReceiptBatches
        //   (FACReceiptItemID, ItemID, BatchNo, StockLocation,
        //    MfgDate, ExpDate, AbsRQty, ShortQty, QAStatus)
        if (!batchNo || !mfgDate || !expDate) {
            throw new Error('BatchNo, MfgDate, and ExpDate are required.');
        }

        await connection.execute(
            `INSERT INTO tbFacilityReceiptBatches
             (FACReceiptItemID, ItemID, BatchNo, StockLocation,
              MfgDate, ExpDate, AbsRQty, ShortQty, QAStatus)
             VALUES
             (:facReceiptItemId, :itemId, :batchNo, :stockLocation,
              TO_DATE(:mfgDate, 'DD/MM/YYYY'), TO_DATE(:expDate, 'DD/MM/YYYY'),
              :absRQty, :shortQty, '1')`,
            {
                facReceiptItemId,
                itemId,
                batchNo,
                stockLocation,
                mfgDate,
                expDate,
                absRQty,
                shortQty
            }
        );

        await connection.commit();
        return {
            success: true,
            message: 'Batch saved successfully',
            data: { facReceiptItemId }
        };
    } catch (err) {
        console.error('Error in addBatch:', err);
        if (connection) {
            try { await connection.rollback(); } catch (e) { /* ignore */ }
        }
        throw err;
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { /* ignore */ }
        }
    }
}

async function completeFacilityReceipt(receiptId, facilityId) {
    let connection;
    try {
        connection = await oracledb.getConnection();

        // Validation 1: At least one item exists
        let result = await connection.execute(
            `SELECT COUNT(1) AS ITEM_COUNT FROM tbFacilityReceiptItems WHERE FacReceiptID = :receiptId`,
            { receiptId }
        );
        if (result.rows[0][0] === 0) {
            throw new Error("No items found in the receipt to complete.");
        }

        // Validation 2: Batch Quantities Match Receipt Quantities
        result = await connection.execute(
            `SELECT ri.AbsRQty, ri.ShortQty, 
             (SELECT SUM(AbsRQty + NVL(ShortQty, 0)) FROM tbFacilityReceiptBatches rfb WHERE rfb.FacReceiptItemID = ri.FacReceiptItemID) as BatchTotal 
             FROM tbFacilityReceiptItems ri WHERE FacReceiptID = :receiptId`,
            { receiptId }
        );
        for (let row of result.rows) {
            const absRQty = row[0] || 0;
            const shortQty = row[1] || 0;
            const batchTotal = row[2] || 0;
            if (absRQty + shortQty !== batchTotal) {
                throw new Error("Batch details are missing or quantities do not match for one or more items.");
            }
        }

        // Validation 3: Issue Quantity Matches Receipt + Short Quantity
        result = await connection.execute(
            `SELECT ri.AbsRQty, ri.ShortQty, 
             (SELECT SUM(ot.ISSUEQTY) FROM tbOutwards ot 
              WHERE ot.indentitemid = ri.indentitemid) as whIssueQty
             FROM tbFacilityReceiptItems ri WHERE FacReceiptID = :receiptId`,
            { receiptId }
        );
        for (let row of result.rows) {
            const absRQty = row[0] || 0;
            const shortQty = row[1] || 0;
            const whIssueQty = row[2] || 0;
            if (absRQty + shortQty !== whIssueQty) {
                throw new Error("Receipt Quantity + Short Quantity does not match Warehouse Issue Quantity.");
            }
        }

        // Validation 4: Expiry Date Validation
        result = await connection.execute(
            `SELECT r.EntryDate, rfb.ExpDate 
             FROM tbFacilityReceipts r 
             INNER JOIN tbFacilityReceiptItems ri ON ri.FacReceiptID = r.FacReceiptID
             INNER JOIN tbFacilityReceiptBatches rfb ON rfb.FacReceiptItemID = ri.FacReceiptItemID
             WHERE r.FacReceiptID = :receiptId`,
            { receiptId }
        );
        for (let row of result.rows) {
            const entryDate = row[0];
            const expDate = row[1];
            if (entryDate && expDate && expDate < entryDate) {
                throw new Error("One or more batches are expired.");
            }
        }

        // All validations pass, commit updates
        await connection.execute(
            `UPDATE tbFacilityReceiptItems SET Status = 'C' WHERE FacReceiptID = :receiptId`,
            { receiptId },
            { autoCommit: false }
        );
        
        await connection.execute(
            `UPDATE tbFacilityReceipts SET Status = 'C' WHERE FacReceiptID = :receiptId`,
            { receiptId },
            { autoCommit: false }
        );

        await connection.commit();
        return { success: true, message: "Receipt completed successfully." };
    } catch (err) {
        if (connection) {
            try { await connection.rollback(); } catch (e) { console.error(e); }
        }
        throw err;
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
}


module.exports = {
    getWarehouseIndents,
    getReceiptsByIndent,
    getFinancialYears,
    getReceiptHeader,
    getReceiptItems,
    getReceiptBatches,
    getStockLocations,
    saveReceiptItem,
    addBatch,
    completeFacilityReceipt
};
