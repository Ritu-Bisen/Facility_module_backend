const db = require('../config/db');

exports.getInFacilityTransferList = async (req, res) => {
    try {
        const { facilityId, accYearId, status } = req.query;

        if (!facilityId || !accYearId) {
            return res.status(400).json({ success: false, message: 'Facility ID and Account Year ID are required' });
        }

        let query = `
            SELECT
                a.IssueID,
                a.IssueNo,
                TO_CHAR(a.IssueDate,'DD-MM-YYYY') AS IssueDate,
                a.WRequestBy,
                a.Remarks,
                NVL(a.Status,'IN') AS Status,
                b.FacilityName AS ToFacility,
                fac.FacilityName AS FromFacility,
                d.DistrictName,
                s.StateName
            FROM tbFacilityIssues a
            INNER JOIN masFacilities fac
                ON fac.FacilityID = a.FacilityID
            INNER JOIN masFacilities b
                ON b.FacilityID = a.ToFacilityID
            LEFT JOIN masDistricts d
                ON d.DistrictID = b.DistrictID
            LEFT JOIN masStates s
                ON s.StateID = d.StateID
            INNER JOIN masAccYearSettings m1
                ON a.IssueDate BETWEEN m1.StartDate AND m1.EndDate
            WHERE a.FacilityID = :facilityId
            AND a.IssueType = 'SP'
            AND m1.AccYrSetID = :accYearId
        `;

        const binds = {
            facilityId,
            accYearId
        };

        if (status === 'IR') {
            query += ` AND NVL(a.Status,'IN') = 'IN'`;
        } else if (status === 'CR') {
            query += ` AND NVL(a.Status,'IN') = 'C'`;
        }
        // If status === 'AI', no additional conditions are needed

        query += ` ORDER BY a.IssueDate DESC`;

        const result = await db.execute(query, binds);

        res.status(200).json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Error fetching in-facility transfer list:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch in-facility transfer list' });
    }
};

exports.getIncomingReceiptsList = async (req, res) => {
    try {
        const { facilityId, accYearId, status } = req.query;

        if (!facilityId || !accYearId) {
            return res.status(400).json({ success: false, message: 'Facility ID and Account Year ID are required' });
        }

        let query = `
            SELECT
                a.IssueID,
                a.IssueNo,
                TO_CHAR(a.IssueDate,'DD-MM-YYYY') AS IssueDate,
                NVL(a.Status,'IN') AS IssueStatus,
                fac.FacilityName AS FromFacility,
                r.FacReceiptID,
                r.FacReceiptNo,
                TO_CHAR(r.FacReceiptDate,'DD-MM-YYYY') AS FacReceiptDate,
                NVL(r.Status,'IN') AS ReceiptStatus
            FROM tbFacilityIssues a
            INNER JOIN masFacilities fac
                ON fac.FacilityID = a.FacilityID
            INNER JOIN masAccYearSettings m1
                ON a.IssueDate BETWEEN m1.StartDate AND m1.EndDate
            LEFT JOIN tbFacilityReceipts r
                ON r.IssueID = a.IssueID
            WHERE a.ToFacilityID = :facilityId
            AND a.IssueType = 'SP'
            AND a.Status = 'C'
            AND m1.AccYrSetID = :accYearId
        `;

        const binds = {
            facilityId,
            accYearId
        };

        query += ` ORDER BY a.IssueDate DESC, r.FacReceiptDate DESC`;

        const result = await db.execute(query, binds);

        // Group the result by IssueID to handle multiple receipts if they exist
        const grouped = result.rows.reduce((acc, row) => {
            const issueId = row[0];
            if (!acc[issueId]) {
                acc[issueId] = {
                    IssueID: row[0],
                    IssueNo: row[1],
                    IssueDate: row[2],
                    IssueStatus: row[3],
                    FromFacility: row[4],
                    Receipts: []
                };
            }
            if (row[5]) { // If FacReceiptID exists
                acc[issueId].Receipts.push({
                    FacReceiptID: row[5],
                    FacReceiptNo: row[6],
                    FacReceiptDate: row[7],
                    ReceiptStatus: row[8]
                });
            }
            return acc;
        }, {});

        res.status(200).json({
            success: true,
            data: Object.values(grouped)
        });

    } catch (error) {
        console.error('Error fetching incoming receipts list:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch incoming receipts list' });
    }
};

exports.getFacilities = async (req, res) => {
    try {
        const { facilityId } = req.params;

        if (!facilityId) {
            return res.status(400).json({ success: false, message: 'Facility ID is required' });
        }

        const query = `
             SELECT
    mf.FACILITYID,
    mf.FACILITYNAME,
    mfw.WAREHOUSEID
FROM MASFACILITIES mf
INNER JOIN MASFACILITYWH mfw
    ON mfw.FACILITYID = mf.FACILITYID
INNER JOIN MASFACILITYTYPES ty
    ON ty.FACILITYTYPEID = mf.FACILITYTYPEID
CROSS JOIN (
    SELECT mft.HODID
    FROM MASFACILITIES mf1
    INNER JOIN MASFACILITYTYPES mft
        ON mft.FACILITYTYPEID = mf1.FACILITYTYPEID
    WHERE mf1.FACILITYID = :facilityId
) cur
WHERE mf.DISTRICTID = (
        SELECT DISTRICTID
        FROM MASFACILITIES
        WHERE FACILITYID = :facilityId
      )
  AND mf.ISACTIVE = 1
  AND ty.HODID = cur.HODID
  AND mf.FACILITYID <> :facilityId
  AND mf.FACILITYNAME NOT LIKE 'DHS%'
ORDER BY ty.ORDERDP, mf.FACILITYNAME
        
        `;

        const result = await db.execute(query, { facilityId });
        
        // Oracle might return an array of arrays or objects depending on outFormat. 
        // We will map it defensively to objects.
        const mappedData = (result.rows || []).map(row => {
            if (Array.isArray(row)) {
                return { facilityId: row[0], facilityName: row[1] };
            }
            return {
                facilityId: row.FACILITYID || row.facilityId,
                facilityName: row.FACILITYNAME || row.facilityName
            };
        });

        res.status(200).json({
            success: true,
            data: mappedData
        });
    } catch (error) {
        console.error('Error fetching facilities:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch facilities' });
    }
};

exports.generateIssueNo = async (req, res) => {
    try {
        const { facilityId } = req.query;

        if (!facilityId) {
            return res.status(400).json({ success: false, message: 'Facility ID is required' });
        }

        const query = `
            SELECT
                mf.FacilityCode || '/TR/' ||
                LPAD(
                    NVL(
                        MAX(
                            TO_NUMBER(
                                REGEXP_SUBSTR(ti.IssueNo, '/([0-9]+)/', 1, 1, 'i', 1)
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
                ON ti.FacilityID = mf.FacilityID
                AND ti.IssueNo LIKE '%/' || ay.SHAccYear
            WHERE mf.FacilityID = :facilityId
            GROUP BY mf.FacilityCode, ay.SHAccYear
        `;

        const result = await db.execute(query, { facilityId });
        
        let issueNo = 'Auto generated';
        if (result.rows && result.rows.length > 0) {
            const row = result.rows[0];
            issueNo = Array.isArray(row) ? row[0] : (row.NEXT_ISSUE_NO || row.Next_Issue_No || row.next_issue_no || issueNo);
        }

        res.status(200).json({
            success: true,
            issueNo
        });
    } catch (error) {
        console.error('Error generating issue number:', error);
        res.status(500).json({ success: false, message: 'Failed to generate issue number' });
    }
};

exports.getItems = async (req, res) => {
    try {
        const { facilityId } = req.query;

        if (!facilityId) {
            return res.status(400).json({ success: false, message: 'Facility ID is required' });
        }

        const query = `
          SELECT
       mi.ITEMID,
       mi.ITEMCODE,
       mi.ITEMNAME
FROM tbfacilityreceiptbatches b
INNER JOIN tbfacilityreceiptitems i
    ON b.facreceiptitemid = i.facreceiptitemid
INNER JOIN tbfacilityreceipts t
    ON t.facreceiptid = i.facreceiptid
INNER JOIN vmasitems mi
    ON mi.itemid = i.itemid
LEFT JOIN (
    SELECT fs.facilityid,
           fsi.itemid,
           ftbo.inwno,
           SUM(NVL(ftbo.issueqty,0)) issueqty
    FROM tbfacilityissues fs
    INNER JOIN tbfacilityissueitems fsi
        ON fsi.issueid = fs.issueid
    INNER JOIN tbfacilityoutwards ftbo
        ON ftbo.issueitemid = fsi.issueitemid
    WHERE NVL(fs.status, 'IN') IN ('C', 'IN')
    GROUP BY fs.facilityid, fsi.itemid, ftbo.inwno
) iq
    ON b.inwno = iq.inwno
   AND iq.itemid = i.itemid
   AND iq.facilityid = t.facilityid
WHERE t.status = 'C'
  AND (b.Whissueblock = 0 OR b.Whissueblock IS NULL)
  AND b.expdate > SYSDATE
  AND t.facilityid = :facilityId
GROUP BY
       mi.ITEMID,
       mi.ITEMCODE,
       mi.ITEMNAME
HAVING SUM(
         CASE
           WHEN b.qastatus = '1'
           THEN NVL(b.absrqty,0) - NVL(iq.issueqty,0)
           ELSE 0
         END
       ) > 0
ORDER BY mi.ITEMCODE
        `;

        const result = await db.execute(query, { facilityId: Number(facilityId) });
        
        const mappedData = (result.rows || []).map(row => {
            if (Array.isArray(row)) {
                return { itemId: row[0], itemCode: row[1], itemName: row[2] };
            }
            return {
                itemId: row.ITEMID || row.itemId,
                itemCode: row.ITEMCODE || row.itemCode,
                itemName: row.ITEMNAME || row.itemName
            };
        });

        res.status(200).json({
            success: true,
            data: mappedData
        });
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch items' });
    }
};

exports.getItemDetails = async (req, res) => {
    try {
        const { facilityId, itemId } = req.query;

        if (!facilityId || !itemId) {
            return res.status(400).json({ success: false, message: 'Facility ID and Item ID are required' });
        }

        const query = `
            SELECT
                mi.itemid,
                mi.itemname,
                CASE
                    WHEN mi.EDLITEMCODE IS NOT NULL
                    THEN mi.EDLITEMCODE
                    ELSE mi.ITEMCODE
                END AS itemcode,
                mi.strength1,
                mi.unit,
                ty.itemtypename,
                mi.unitcount AS packqty,
                mvm.EDLTYPE2025,
                SUM(
                    CASE
                        WHEN b.qastatus = '1'
                        THEN NVL(b.absrqty,0) - NVL(iq.issueqty,0)
                        ELSE 0
                    END
                ) AS facilitystock
            FROM tbfacilityreceiptbatches b
            INNER JOIN tbfacilityreceiptitems i
                ON b.facreceiptitemid = i.facreceiptitemid
            INNER JOIN tbfacilityreceipts t
                ON t.facreceiptid = i.facreceiptid
            INNER JOIN vmasitems mi
                ON mi.itemid = i.itemid
            LEFT JOIN masitemtypes ty
                ON ty.itemtypeid = mi.itemtypeid
            LEFT JOIN mv_masitems mvm
                ON mvm.itemcode = mi.EDLITEMCODE
            LEFT JOIN (
                SELECT
                    fs.facilityid,
                    fsi.itemid,
                    ftbo.inwno,
                    SUM(NVL(ftbo.issueqty,0)) issueqty
                FROM tbfacilityissues fs
                INNER JOIN tbfacilityissueitems fsi
                    ON fsi.issueid = fs.issueid
                INNER JOIN tbfacilityoutwards ftbo
                    ON ftbo.issueitemid = fsi.issueitemid
                WHERE NVL(fs.status, 'IN') IN ('C', 'IN')
                GROUP BY fs.facilityid, fsi.itemid, ftbo.inwno
            ) iq
                ON iq.inwno = b.inwno
                AND iq.itemid = i.itemid
                AND iq.facilityid = t.facilityid
            WHERE t.status = 'C'
                AND (b.Whissueblock = 0 OR b.Whissueblock IS NULL)
                AND b.expdate > SYSDATE
                AND t.facilityid = :facilityId
                AND mi.itemid = :itemId
            GROUP BY
                mi.itemid,
                mi.itemname,
                mi.itemcode,
                mi.edlitemcode,
                mi.strength1,
                mi.unit,
                ty.itemtypename,
                mi.unitcount,
                mvm.EDLTYPE2025
        `;

        const result = await db.execute(query, { facilityId: Number(facilityId), itemId: Number(itemId) });

        if (result.rows && result.rows.length > 0) {
            const row = result.rows[0];
            const data = Array.isArray(row) ? {
                itemId: row[0],
                itemName: row[1],
                itemCode: row[2],
                strength: row[3],
                unit: row[4],
                type: row[5],
                packQty: row[6],
                edlType: row[7],
                stock: row[8]
            } : {
                itemId: row.ITEMID || row.itemid,
                itemName: row.ITEMNAME || row.itemname,
                itemCode: row.ITEMCODE || row.itemcode,
                strength: row.STRENGTH1 || row.strength1,
                unit: row.UNIT || row.unit,
                type: row.ITEMTYPENAME || row.itemtypename,
                packQty: row.PACKQTY || row.packqty,
                edlType: row.EDLTYPE2025 || row.edltype2025,
                stock: row.FACILITYSTOCK || row.facilitystock || 0
            };

            res.status(200).json({ success: true, data });
        } else {
            res.status(200).json({ success: true, data: null });
        }
    } catch (error) {
        console.error('Error fetching item details:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch item details' });
    }
};

exports.saveIssueItem = async (req, res) => {
    try {
        const { issueItemId, issueId, itemId, currentStock, allotted, issueQty } = req.body;

        if (!issueId || !itemId) {
            return res.status(400).json({ success: false, message: 'Issue ID and Item ID are required' });
        }

        if (issueItemId) {
            // Update
            const query = `
                UPDATE tbFacilityIssueItems
                SET
                    IssueID = :issueId,
                    ItemID = :itemId,
                    CurrentStock = :currentStock,
                    Allotted = :allotted,
                    IssueQty = :issueQty
                WHERE IssueItemID = :issueItemId
            `;
            await db.execute(query, {
                issueId: Number(issueId),
                itemId: Number(itemId),
                currentStock: Number(currentStock || 0),
                allotted: Number(allotted || 0),
                issueQty: Number(issueQty || 0),
                issueItemId: Number(issueItemId)
            }, { autoCommit: true });
            return res.status(200).json({ success: true, message: 'Item updated successfully', issueItemId });
        } else {
            // Insert
            const query = `
                INSERT INTO tbFacilityIssueItems
                (
                    IssueID,
                    ItemID,
                    CurrentStock,
                    Allotted,
                    IssueQty
                )
                VALUES
                (
                    :issueId,
                    :itemId,
                    :currentStock,
                    :allotted,
                    :issueQty
                )
            `;
            await db.execute(query, {
                issueId: Number(issueId),
                itemId: Number(itemId),
                currentStock: Number(currentStock || 0),
                allotted: Number(allotted || 0),
                issueQty: Number(issueQty || 0)
            }, { autoCommit: true });
            
            // To get the inserted ID we could fetch the max ID for this issue
            const fetchQuery = `SELECT MAX(IssueItemID) as MAX_ID FROM tbFacilityIssueItems WHERE IssueID = :issueId AND ItemID = :itemId`;
            const fetchResult = await db.execute(fetchQuery, { issueId: Number(issueId), itemId: Number(itemId) });
            let newId = null;
            if (fetchResult.rows && fetchResult.rows.length > 0) {
                const row = fetchResult.rows[0];
                newId = Array.isArray(row) ? row[0] : (row.MAX_ID || row.max_id);
            }

            return res.status(200).json({ success: true, message: 'Item saved successfully', issueItemId: newId });
        }
    } catch (error) {
        console.error('Error saving issue item:', error);
        res.status(500).json({ success: false, message: 'Failed to save issue item' });
    }
};

exports.deleteIssueItem = async (req, res) => {
    try {
        const { issueItemId } = req.params;
        if (!issueItemId) {
            return res.status(400).json({ success: false, message: 'Issue Item ID is required' });
        }

        const query = `DELETE FROM tbFacilityIssueItems WHERE IssueItemID = :issueItemId`;
        await db.execute(query, { issueItemId: Number(issueItemId) }, { autoCommit: true });

        return res.status(200).json({ success: true, message: 'Item deleted successfully' });
    } catch (error) {
        console.error('Error deleting issue item:', error);
        res.status(500).json({ success: false, message: 'Failed to delete issue item' });
    }
};

exports.getIssueById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ success: false, message: 'Issue ID is required' });
        }

        const issueQuery = `
            SELECT 
                IssueID,
                ToFacilityID,
                IssueNo,
                IssueDate,
                Status,
                Remarks
            FROM tbFacilityIssues WHERE IssueID = :id
        `;
        const issueResult = await db.execute(issueQuery, { id: Number(id) });

        if (!issueResult.rows || issueResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Issue not found' });
        }

        const itemsQuery = `
            SELECT 
                IssueItemID,
                IssueID,
                ItemID,
                CurrentStock,
                Allotted,
                IssueQty
            FROM tbFacilityIssueItems WHERE IssueID = :id
        `;
        const itemsResult = await db.execute(itemsQuery, { id: Number(id) });

        // Map column names for frontend based on explicit select order
        const issue = issueResult.rows[0];
        const mappedIssue = Array.isArray(issue) ? {
            IssueID: issue[0],
            ToFacilityID: issue[1],
            IssueNo: issue[2],
            IssueDate: issue[3],
            Status: issue[4],
            Remarks: issue[5]
        } : {
            IssueID: issue.ISSUEID || issue.IssueID || issue.issueid,
            ToFacilityID: issue.TOFACILITYID || issue.ToFacilityID || issue.tofacilityid,
            IssueNo: issue.ISSUENO || issue.IssueNo || issue.issueno,
            IssueDate: issue.ISSUEDATE || issue.IssueDate || issue.issuedate,
            Status: issue.STATUS || issue.Status || issue.status,
            Remarks: issue.REMARKS || issue.Remarks || issue.remarks
        };

        const mappedItems = (itemsResult.rows || []).map(row => {
            return Array.isArray(row) ? {
                IssueItemID: row[0],
                IssueID: row[1],
                ItemID: row[2],
                CurrentStock: row[3],
                Allotted: row[4],
                IssueQty: row[5]
            } : {
                IssueItemID: row.ISSUEITEMID || row.IssueItemID || row.issueitemid,
                IssueID: row.ISSUEID || row.IssueID || row.issueid,
                ItemID: row.ITEMID || row.ItemID || row.itemid,
                CurrentStock: row.CURRENTSTOCK || row.CurrentStock || row.currentstock,
                Allotted: row.ALLOTTED || row.Allotted || row.allotted,
                IssueQty: row.ISSUEQTY || row.IssueQty || row.issueqty
            };
        });

        return res.status(200).json({ success: true, issue: mappedIssue, items: mappedItems });
    } catch (error) {
        console.error('Error fetching issue by ID:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch issue' });
    }
};

exports.updateIssueHeader = async (req, res) => {
    try {
        const { id } = req.params;
        const { toFacilityId, issueDate, remarks } = req.body;

        if (!id) {
            return res.status(400).json({ success: false, message: 'Issue ID is required' });
        }
        if (!toFacilityId || !issueDate) {
            return res.status(400).json({ success: false, message: 'To Facility and Issue Date are required' });
        }

        const query = `
            UPDATE tbFacilityIssues
            SET ToFacilityID = :toFacilityId,
                IssueDate = TO_DATE(:issueDate, 'YYYY-MM-DD'),
                WRequestBy = :remarks,
                Remarks = :remarks
            WHERE IssueID = :id
        `;

        await db.execute(query, {
            toFacilityId: Number(toFacilityId),
            issueDate,
            remarks: remarks || '',
            id: Number(id)
        }, { autoCommit: true });

        return res.status(200).json({ success: true, message: 'Issue updated successfully' });
    } catch (error) {
        console.error('Error updating issue header:', error);
        res.status(500).json({ success: false, message: 'Failed to update issue' });
    }
};

exports.freezeIssue = async (req, res) => {
    let connection;
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ success: false, message: 'Issue ID is required' });
        }

        connection = await require('oracledb').getConnection();

        // 1. Get the issue details
        const issueQuery = `SELECT ToFacilityID, FacilityID, IssueID, IssueNo, Remarks FROM tbFacilityIssues WHERE IssueID = :id`;
        const issueResult = await connection.execute(issueQuery, { id: Number(id) });
        
        if (!issueResult.rows || issueResult.rows.length === 0) {
            throw new Error('Issue not found');
        }

        const row = issueResult.rows[0];
        const toFacilityId = Array.isArray(row) ? row[0] : (row.TOFACILITYID || row.ToFacilityID);
        const facilityId = Array.isArray(row) ? row[1] : (row.FACILITYID || row.FacilityID);
        const issueNo = Array.isArray(row) ? row[3] : (row.ISSUENO || row.IssueNo);
        const remarks = Array.isArray(row) ? row[4] : (row.REMARKS || row.Remarks);

        // 2. Get the FacilityCode of the receiving facility
        const facQuery = `SELECT FacilityCode FROM masFacilities WHERE FacilityID = :toFacilityId`;
        const facResult = await connection.execute(facQuery, { toFacilityId: Number(toFacilityId) });
        let facilityCode = '00000';
        if (facResult.rows && facResult.rows.length > 0) {
            const facRow = facResult.rows[0];
            facilityCode = Array.isArray(facRow) ? facRow[0] : (facRow.FACILITYCODE || facRow.FacilityCode);
        }

        // 3. Generate FacReceiptNo
        // Extract the last two parts of IssueNo (e.g., '08037/SP/00002/26-27' -> '00002/26-27')
        const issueNoParts = (issueNo || '').split('/');
        let lastTwoParts = '00000/00-00';
        if (issueNoParts.length >= 2) {
            lastTwoParts = `${issueNoParts[issueNoParts.length - 2]}/${issueNoParts[issueNoParts.length - 1]}`;
        }
        const facReceiptNo = `${facilityCode}/SP/${lastTwoParts}`;

        // 4. Complete the issue
        const completeQuery = `UPDATE tbFacilityIssues SET Status = 'C' WHERE IssueID = :id`;
        await connection.execute(completeQuery, { id: Number(id) });

        // 5. Create tbFacilityReceipts
        const insertReceiptQuery = `
            INSERT INTO tbFacilityReceipts
            (
                FacReceiptNo,
                FacReceiptDate,
                FacilityID,
                WarehouseID,
                IssueID,
                Status,
                Remarks,
                FacReceiptType
            )
            VALUES
            (
                :facReceiptNo,
                SYSDATE,
                :toFacilityId,
                :facilityId,
                :issueId,
                'I',
                :remarks,
                'SP'
            )
        `;
        
        await connection.execute(insertReceiptQuery, {
            facReceiptNo: facReceiptNo,
            toFacilityId: Number(toFacilityId),
            facilityId: Number(facilityId),
            issueId: Number(id),
            remarks: remarks || ''
        });

        await connection.commit();
        return res.status(200).json({ success: true, message: 'Issue frozen successfully' });
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (e) {}
        }
        console.error('Error freezing issue:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to freeze issue' });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) {}
        }
    }
};
