const db = require('../config/db');
const oracledb = require('oracledb');

exports.getHeader = async (req, res) => {
    try {
        const { indentId } = req.params;
        const facilityId = req.user ? req.user.facilityId : req.query.facilityId;

        const query = `
            SELECT 
                0 as "slNo", yr.AccYrSetID as "accYrSetId", yr.AccYear as "accYear", 
                0 as "sourceId", 0 as "sourceName", 0 as "schemeId", 0 as "schemeName",
                a.facilityid as "warehouseId", m1.facilityname as "warehouseName", a.issueid as "indentId", 
                a.issueno as "indentNo", TO_CHAR(a.issuedate, 'DD-MM-YYYY') as "indentDate",
                a.issueno as "facIndentNo", TO_CHAR(a.issuedate, 'DD-MM-YYYY') as "facIndentDate",
                tbr.facreceiptno as "facReceiptNo", TO_CHAR(tbr.facreceiptdate, 'DD-MM-YYYY') as "facReceiptDate",
                tbr.FacReceiptID as "facReceiptId"
            FROM tbfacilityissues a 
            LEFT OUTER JOIN tbfacilityreceipts tbr on tbr.issueid=a.issueid 
            INNER JOIN masfacilities m1 on (m1.facilityid=a.facilityid) 
            INNER JOIN masAccYearSettings yr on a.issuedate between yr.StartDate and yr.EndDate 
            WHERE a.toFacilityID = :facilityId and a.Issueid = :indentId
        `;

        const result = await db.execute(query, { facilityId, indentId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        
        if (result.rows && result.rows.length > 0) {
            let row = result.rows[0];
            
            // If FacReceiptNo doesn't exist, generate it
            if (!row.facReceiptNo) {
                // 1. Get Facility Code
                const facRes = await db.execute('SELECT FacilityCode FROM masFacilities WHERE FacilityID = :facilityId', { facilityId });
                const facCode = facRes.rows && facRes.rows.length > 0 ? facRes.rows[0][0] || facRes.rows[0].FACILITYCODE : '';
                
                // 2. Get AccYear
                const yrRes = await db.execute('SELECT SHAccYear FROM masAccYearSettings WHERE SYSDATE BETWEEN StartDate AND EndDate', {});
                let shAccYear;
                if (!yrRes.rows || yrRes.rows.length === 0) {
                    const d = new Date();
                    const y = d.getFullYear();
                    const m = d.getMonth();
                    shAccYear = m >= 3 ? `${y.toString().slice(-2)}-${(y+1).toString().slice(-2)}` : `${(y-1).toString().slice(-2)}-${y.toString().slice(-2)}`;
                } else {
                    shAccYear = yrRes.rows[0][0] || yrRes.rows[0].SHACCYEAR;
                }
                
                // 3. Get next sequence
                const pattern = `${facCode}/SP/%/${shAccYear}`;
                const seqRes = await db.execute(`
                    SELECT LPAD(NVL(MAX(TO_NUMBER(SUBSTR(FacReceiptNo, INSTR(FacReceiptNo, '/SP/') + 4, 5))), 0) + 1, 5, '0') AS nextSeq
                    FROM tbFacilityReceipts
                    WHERE FacReceiptNo LIKE :pattern
                `, { pattern });
                
                const nextSeq = seqRes.rows && seqRes.rows.length > 0 ? seqRes.rows[0][0] || seqRes.rows[0].NEXTSEQ : '00001';
                
                row.facReceiptNo = `${facCode}/SP/${nextSeq}/${shAccYear}`;
                
                // Format today's date for facReceiptDate
                const today = new Date();
                const dd = String(today.getDate()).padStart(2, '0');
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const yyyy = today.getFullYear();
                row.facReceiptDate = `${dd}-${mm}-${yyyy}`;
            }

            res.json({ success: true, data: row });
        } else {
            res.status(404).json({ success: false, message: 'Header not found' });
        }
    } catch (error) {
        console.error('Error in getHeader:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getHeaderInfo = async (req, res) => {
    try {
        const { facReceiptId } = req.params;
        
        const query = `
            SELECT 
                0 as "slNo", yr.AccYrSetID as "accYrSetId", yr.AccYear as "accYear", 
                a.facilityid as "warehouseId", m1.facilityname as "warehouseName", a.issueid as "indentId", a.issueid as "issueId",
                a.issueno as "indentNo", TO_CHAR(a.issuedate, 'DD-MM-YYYY') as "indentDate",
                a.issueno as "facIndentNo", TO_CHAR(a.issuedate, 'DD-MM-YYYY') as "facIndentDate",
                tbr.facreceiptno as "facReceiptNo", TO_CHAR(tbr.facreceiptdate, 'DD-MM-YYYY') as "facReceiptDate",
                tbr.FacReceiptID as "facReceiptId",
                tbr.Remarks as "remarks",
                tbr.Status as "status",
                tbr.TOFACILITYID as "toFacilityId"
            FROM tbfacilityreceipts tbr
            INNER JOIN tbfacilityissues a ON a.issueid = tbr.issueid
            INNER JOIN masfacilities m1 on m1.facilityid = a.facilityid
            INNER JOIN masAccYearSettings yr on a.issuedate between yr.StartDate and yr.EndDate 
            WHERE tbr.FacReceiptID = :facReceiptId
        `;

        const result = await db.execute(query, { facReceiptId: Number(facReceiptId) }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        
        if (result.rows && result.rows.length > 0) {
            res.json({ success: true, data: result.rows[0] });
        } else {
            res.status(404).json({ success: false, message: 'Receipt not found' });
        }
    } catch (error) {
        console.error('Error in getHeaderInfo:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.saveHeader = async (req, res) => {
    try {
        let {
            facReceiptId,
            indentId,
            warehouseId,
            facReceiptNo,
            facReceiptDate
        } = req.body;

        const facilityId = req.user
            ? req.user.facilityId
            : req.body.facilityId;

        // Ensure date is in YYYY-MM-DD for TO_DATE
        if (facReceiptDate) {
            let parts;

            if (facReceiptDate.includes('/')) {
                parts = facReceiptDate.split('/');
            } else if (facReceiptDate.includes('-')) {
                parts = facReceiptDate.split('-');
            }

            if (parts && parts.length === 3) {
                if (parts[0].length !== 4) {
                    facReceiptDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
            }
        }

        if (facReceiptId) {
            // Update Existing Receipt
            const updateQuery = `
                UPDATE tbFacilityReceipts
                SET FacReceiptNo = :facReceiptNo,
                    FacReceiptType = 'SP',
                    FacReceiptDate = TO_DATE(:facReceiptDate, 'YYYY-MM-DD'),
                    Issueid = :indentId
                WHERE FacReceiptID = :facReceiptId
            `;

            await db.execute(
                updateQuery,
                {
                    facReceiptNo,
                    facReceiptDate,
                    indentId: Number(indentId),
                    facReceiptId: Number(facReceiptId)
                },
                { autoCommit: true }
            );

            return res.json({
                success: true,
                data: { facReceiptId }
            });
        }

        // Insert New Receipt
        const insertQuery = `
            INSERT INTO tbFacilityReceipts (
                FacilityID,
                Issueid,
                TOFACILITYID,
                FacReceiptNo,
                FacReceiptDate,
                FacReceiptType
            )
            VALUES (
                :facilityId,
                :indentId,
                :warehouseId,
                :facReceiptNo,
                TO_DATE(:facReceiptDate, 'YYYY-MM-DD'),
                'SP'
            )
        `;

        await db.execute(
            insertQuery,
            {
                facilityId: Number(facilityId),
                warehouseId: Number(warehouseId),
                indentId: Number(indentId),
                facReceiptNo,
                facReceiptDate
            },
            { autoCommit: true }
        );

        // Fetch Inserted Receipt ID
        const fetchQuery = `
            SELECT FacReceiptID AS "facReceiptId"
            FROM tbFacilityReceipts
            WHERE FacilityID = :facilityId
              AND TOFACILITYID = :warehouseId
              AND FacReceiptNo = :facReceiptNo
              AND FacReceiptDate = TO_DATE(:facReceiptDate, 'YYYY-MM-DD')
              AND Issueid = :indentId
            ORDER BY FacReceiptID DESC
            FETCH FIRST 1 ROW ONLY
        `;

        const result = await db.execute(
            fetchQuery,
            {
                facilityId: Number(facilityId),
                warehouseId: Number(warehouseId),
                facReceiptNo,
                facReceiptDate,
                indentId: Number(indentId)
            },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows && result.rows.length > 0) {
            return res.json({
                success: true,
                data: result.rows[0]
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve inserted receipt ID'
        });

    } catch (error) {
        console.error('Error in saveHeader:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getItems = async (req, res) => {
    try {
        const { indentId, facReceiptId } = req.query;

        // Note: The document provided a truncated query. We will reconstruct it properly.
        const query = `
            SELECT DISTINCT 
                0 as "slNo", 
                NVL(f.FacReceiptID, :facReceiptId) as "facReceiptId",
                b.FacReceiptItemID as "facReceiptItemId", 
                o.issueitemid as "indentItemId",
                o.ItemID as "itemId",
                a.ItemName as "itemName",
                a.ItemCode as "itemCode", 
                a.Strength1 as "strength",
                o.Allotted as "allotted", 
                o.Allotted as "needed", 
                0 as "singleUnitPrice", 
                0 as "supplierPackQty", 
                NVL(o.Allotted,0) - NVL(b.AbsRQty,0) as "balReceiptQty",
                b.Remarks as "remarks", 
                b.HasDiscrepency as "hasDiscrepency", 
                SUM(CASE WHEN b.AbsRQty IS NOT NULL AND b.AbsRQty != 0 THEN b.AbsRQty ELSE Ots.IssueQty END) OVER (PARTITION BY o.ItemID) as "absRQty", 
                b.ItemValue as "itemValue",  
                a.HighlightNullBatches as "highlightNullBatches",
                CASE WHEN b.AbsRQty IS NULL OR b.AbsRQty = 0 THEN 'false' ELSE 'true' END as "isVerified", 
                CASE WHEN b.AbsRQty IS NULL OR b.AbsRQty = 0 THEN '@true' ELSE 'false' END as "isEnabled", 
                a.Unit as "unit", 
                a.PackingQty as "packingQty",
                COALESCE(b.STOCKLOCATION, (SELECT MAX(rfb.STOCKLOCATION) FROM tbFacilityReceiptBatches rfb WHERE rfb.FacReceiptItemID = b.FacReceiptItemID)) as "stockLocation"
            FROM tbfacilityreceipts f
            INNER JOIN tbfacilityissueitems o ON (o.issueid = f.issueid)
            LEFT OUTER JOIN tbfacilityoutwards Ots ON (Ots.issueitemid = o.issueitemid) 
            LEFT OUTER JOIN vmasitems a ON (a.itemid = o.itemid)
            LEFT OUTER JOIN tbfacilityreceiptitems b ON (b.indentitemid = o.issueitemid AND b.FacReceiptID = f.FacReceiptID)
            WHERE f.FacReceiptID = :facReceiptId
            ORDER BY a.ItemCode
        `;

        const result = await db.execute(query, { 
            facReceiptId: facReceiptId ? Number(facReceiptId) : null
        }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        
        res.json({ success: true, data: result.rows || [] });
    } catch (error) {
        console.error('Error in getItems:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.saveItem = async (req, res) => {
    let connection;
    try {
        const { facReceiptId, indentItemId, itemId, facReceiptAbsQty, stockLocation, batches } = req.body;
        
        connection = await oracledb.getConnection();
        
        // Check if duplicate (exists)
        const checkQuery = "SELECT FacReceiptItemID FROM tbFacilityReceiptItems WHERE FacReceiptID = :facReceiptId AND ItemID = :itemId";
        const checkResult = await connection.execute(checkQuery, { facReceiptId: Number(facReceiptId), itemId: Number(itemId) }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        
        let facReceiptItemId;
        if (checkResult.rows && checkResult.rows.length > 0) {
            facReceiptItemId = checkResult.rows[0].FACRECEIPTITEMID;
            // Update
            const updateQuery = `
                UPDATE tbFacilityReceiptItems 
                SET IndentItemID = :indentItemId, 
                    AbsRQty = :facReceiptAbsQty,
                    StockLocation = :stockLocation
                WHERE FacReceiptItemID = :facReceiptItemId
            `;
            await connection.execute(updateQuery, {
                indentItemId: Number(indentItemId),
                facReceiptAbsQty: Number(facReceiptAbsQty),
                stockLocation: stockLocation ? String(stockLocation) : null,
                facReceiptItemId: Number(facReceiptItemId)
            });
            
            // Delete existing batches to re-insert
            await connection.execute(`DELETE FROM tbFacilityReceiptBatches WHERE FacReceiptItemID = :facReceiptItemId`, [facReceiptItemId]);
        } else {
            // Insert
            const insertQuery = `
                INSERT INTO tbFacilityReceiptItems (FacReceiptID, IndentItemID, ItemID, AbsRQty, StockLocation)
                VALUES (:facReceiptId, :indentItemId, :itemId, :facReceiptAbsQty, :stockLocation)
                RETURNING FacReceiptItemID INTO :outId
            `;
            const insertResult = await connection.execute(insertQuery, {
                facReceiptId: Number(facReceiptId),
                indentItemId: Number(indentItemId),
                itemId: Number(itemId),
                facReceiptAbsQty: Number(facReceiptAbsQty),
                stockLocation: stockLocation ? String(stockLocation) : null,
                outId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
            });
            facReceiptItemId = insertResult.outBinds.outId[0];
        }

        // Insert batches
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
                if (!b.batchNo || !b.mfgDate || !b.expDate) continue;
                await connection.execute(batchQuery, {
                    facReceiptItemId,
                    itemId: Number(itemId),
                    batchNo: b.batchNo,
                    stockLocation: stockLocation ? String(stockLocation) : null,
                    mfgDate: b.mfgDate,
                    expDate: b.expDate,
                    absRQty: Number(b.issueQty || 0),
                    shortQty: 0
                });
            }
        }

        await connection.commit();
        res.json({ success: true, message: 'Item saved successfully' });
    } catch (error) {
        console.error('Error in saveItem:', error);
        if (connection) {
            try { await connection.rollback(); } catch(e) {}
        }
        res.status(500).json({ success: false, message: error.message });
    } finally {
        if (connection) {
            try { await connection.close(); } catch(e) {}
        }
    }
};

exports.getBatches = async (req, res) => {
    try {
        const { indentItemId } = req.params;
        const query = `
            SELECT 
                0 as "slNo",
                rb.batchno as "batchNo",
                ot.issueqty as "issueQty",
                TO_CHAR(rb.mfgdate,'DD/MM/YYYY') as "mfgDate",
                TO_CHAR(rb.expdate,'DD/MM/YYYY') as "expDate"
            FROM tbfacilityissueitems ii   
            LEFT OUTER JOIN tbfacilityoutwards ot on ot.issueitemid=ii.issueitemid 
            LEFT OUTER JOIN tbfacilityreceiptbatches rb on rb.inwno=ot.inwno   
            WHERE ii.issueitemid = :indentItemId
        `;

        const result = await db.execute(query, { indentItemId: Number(indentItemId) }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        res.json({ success: true, data: result.rows || [] });
    } catch (error) {
        console.error('Error in getBatches:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.completeReceipt = async (req, res) => {
    let connection;
    try {
        const { facReceiptId } = req.params;
        const remarks = req.body.remarks || '';

        connection = await oracledb.getConnection();
        
        // Validation 1: Check if items exist
        let checkItems = await connection.execute(`SELECT COUNT(1) AS CNT FROM tbFacilityReceiptItems WHERE FacReceiptID = :facReceiptId`, { facReceiptId: Number(facReceiptId) });
        if (checkItems.rows[0][0] === 0) {
            throw new Error("No items found to complete receipt.");
        }

        await connection.execute(`UPDATE tbFacilityReceiptItems SET Status = 'C' WHERE FacReceiptID = :facReceiptId`, { facReceiptId: Number(facReceiptId) });
        await connection.execute(`UPDATE tbFacilityReceipts SET Status = 'C', Remarks = :remarks WHERE FacReceiptID = :facReceiptId`, { facReceiptId: Number(facReceiptId), remarks });

        await connection.commit();
        res.json({ success: true, message: 'Receipt completed successfully' });
    } catch (error) {
        console.error('Error in completeReceipt:', error);
        if (connection) {
            try { await connection.rollback(); } catch(e) {}
        }
        res.status(500).json({ success: false, message: error.message });
    } finally {
        if (connection) {
            try { await connection.close(); } catch(e) {}
        }
    }
};

exports.deleteReceipt = async (req, res) => {
    let connection;
    try {
        const { facReceiptId } = req.params;

        connection = await oracledb.getConnection();
        
        await connection.execute(`DELETE FROM tbFacilityReceiptBatches WHERE FacReceiptItemID IN (SELECT FacReceiptItemID FROM tbFacilityReceiptItems WHERE FacReceiptID = :facReceiptId)`, { facReceiptId: Number(facReceiptId) });
        await connection.execute(`DELETE FROM tbFacilityReceiptItems WHERE FacReceiptID = :facReceiptId`, { facReceiptId: Number(facReceiptId) });
        await connection.execute(`DELETE FROM tbFacilityReceipts WHERE FacReceiptID = :facReceiptId`, { facReceiptId: Number(facReceiptId) });

        await connection.commit();
        res.json({ success: true, message: 'Receipt deleted successfully' });
    } catch (error) {
        console.error('Error in deleteReceipt:', error);
        if (connection) {
            try { await connection.rollback(); } catch(e) {}
        }
        res.status(500).json({ success: false, message: error.message });
    } finally {
        if (connection) {
            try { await connection.close(); } catch(e) {}
        }
    }
};
