const oracledb = require('oracledb');
const db = require('../config/db');
const wardIssueModel = require('../models/wardIssueModel');

exports.getBreakageVoucherList = async (req, res) => {
    try {
        const { facilityId, accYearId, status = 'AI' } = req.query;

        if (!facilityId || !accYearId) {
            return res.status(400).json({
                success: false,
                message: 'FacilityID and AccYearID are required.'
            });
        }

        let query = `
            SELECT 
                0 as "SlNo",
                0 as "WardID",
                '0' as "WardName",
                c.StateName as "StateName",
                fac.FacilityName as "FacilityName",
                d.DistrictName as "DistrictName",
                a.IssueNo as "IssueNo",
                TO_CHAR(a.IssueDate, 'DD-MM-YYYY') as "IssueDate",
                a.WRequestBy as "WRequestBy",
                NVL(a.Status, 'IN') as "Status",
                a.IssueID as "IssueID"
            FROM tbFacilityIssues a
            INNER JOIN masFacilities fac ON fac.FacilityID = a.FacilityID
            INNER JOIN masStates c ON c.StateID = fac.StateID
            INNER JOIN masDistricts d ON d.StateID = c.StateID AND d.DistrictID = fac.DistrictID
            INNER JOIN masAccYearSettings m1 ON a.IssueDate BETWEEN m1.StartDate AND m1.EndDate
            WHERE a.FacilityID = :facilityId
              AND m1.AccYrSetID = :accYearId
              AND a.IssueType = 'BR'
        `;

        if (status === 'IR') {
            query += " AND NVL(a.Status, 'IN') = 'IN'";
        } else if (status === 'CR') {
            query += " AND NVL(a.Status, 'IN') = 'C'";
        }

        query += " ORDER BY a.IssueDate DESC, a.IssueID DESC";

        const binds = {
            facilityId: Number(facilityId),
            accYearId: Number(accYearId)
        };

        const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });

        res.status(200).json({
            success: true,
            data: result.rows || []
        });

    } catch (error) {
        console.error('Error fetching breakage voucher list:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.generateIssueNo = async (req, res) => {
    try {
        const { facilityId } = req.query;
        if (!facilityId) {
            return res.status(400).json({ error: "facilityId is required" });
        }
        
        const oracledb = require('oracledb');

        // 1. Get Facility Code
        const facQuery = `SELECT FacilityCode FROM masFacilities WHERE FacilityID = :facilityId`;
        const facResult = await db.execute(facQuery, { facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        
        if (!facResult.rows || facResult.rows.length === 0) {
            return res.status(400).json({ error: "Facility not found" });
        }
        const mWHPrefix = facResult.rows[0].FACILITYCODE || facResult.rows[0].FacilityCode;
        
        // 2. Get Financial Year
        const todayDate = new Date();
        const d = String(todayDate.getDate()).padStart(2, '0');
        const m = String(todayDate.getMonth() + 1).padStart(2, '0');
        const y = todayDate.getFullYear();
        const mToday = `TO_DATE('${d}/${m}/${y}', 'DD/MM/YYYY')`;
        const accYearQuery = `SELECT SHAccYear FROM masAccYearSettings WHERE ${mToday} BETWEEN StartDate AND EndDate`;
        const accYearResult = await db.execute(accYearQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        
        if (!accYearResult.rows || accYearResult.rows.length === 0) {
            return res.status(400).json({ error: "Financial year not found for current date" });
        }
        const mSHAccYear = accYearResult.rows[0].SHACCYEAR || accYearResult.rows[0].SHAccYear;
        
        const mType = "BR";
        
        // 3. Get next sequence number
        const seqQuery = `SELECT LPAD(NVL(MAX(TO_NUMBER(SUBSTR(IssueNo, -11, 5))), 0) + 1, 5, '0') as WHSLNO 
                          FROM tbFacilityIssues 
                          WHERE IssueNo LIKE :pattern`;
        const pattern = `${mWHPrefix}/${mType}/%/${mSHAccYear}`;
        
        const seqResult = await db.execute(seqQuery, { pattern }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        
        let mGenNo = "";
        if (seqResult.rows && seqResult.rows.length > 0 && (seqResult.rows[0].WHSLNO || seqResult.rows[0].WHSlNo)) {
            const whSlNo = seqResult.rows[0].WHSLNO || seqResult.rows[0].WHSlNo;
            mGenNo = `${mWHPrefix}/${mType}/${whSlNo}/${mSHAccYear}`;
        } else {
            mGenNo = `${mWHPrefix}/${mType}/00001/${mSHAccYear}`;
        }
        
        res.json({ issueNo: mGenNo });
    } catch (error) {
        console.error('Error generating issue no:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getHeaderInfo = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT 
                IssueID as "issueId",
                FacilityID as "facilityId",
                IssueNo as "issueNo",
                TO_CHAR(IssueDate, 'YYYY-MM-DD') as "issueDate",
                NVL(Status, 'IN') as "status",
                Remarks as "remarks"
            FROM tbFacilityIssues 
            WHERE IssueID = :id AND IssueType = 'BR'
        `;
        const result = await db.execute(query, { id }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Not found" });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching header:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.saveHeaderInfo = async (req, res) => {
    try {
        const { issueId, facilityId, issueNo, issueDate, remarks = '' } = req.body;
        
        if (!facilityId || !issueNo || !issueDate) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        let newIssueId = issueId;
        
        if (!issueId || issueId == 0) {
            const query = `
                INSERT INTO tbFacilityIssues (FacilityID, IssueNo, IssueDate, IssueType, Remarks) 
                VALUES (:facilityId, :issueNo, TO_DATE(:issueDate, 'YYYY-MM-DD'), 'BR', :remarks) 
                RETURNING IssueID INTO :newIssueId
            `;
            const binds = {
                facilityId: Number(facilityId),
                issueNo,
                issueDate,
                remarks,
                newIssueId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
            };
            const result = await db.execute(query, binds, { autoCommit: true });
            newIssueId = result.outBinds.newIssueId[0];
        } else {
            const query = `
                UPDATE tbFacilityIssues 
                SET FacilityID = :facilityId, 
                    IssueNo = :issueNo, 
                    IssueDate = TO_DATE(:issueDate, 'YYYY-MM-DD'), 
                    Remarks = :remarks 
                WHERE IssueID = :issueId AND IssueType = 'BR'
            `;
            const binds = {
                facilityId: Number(facilityId),
                issueNo,
                issueDate,
                remarks,
                issueId: Number(issueId)
            };
            await db.execute(query, binds, { autoCommit: true });
        }

        res.json({ message: "Updated Successfully", issueId: newIssueId });
    } catch (error) {
        console.error('Error saving header:', error);
        res.status(500).json({ error: error.message });
    }
}

exports.saveBreakageItem = async (req, res) => {
    try {
        const { id } = req.params; // issueId
        const data = req.body; 
        data.issueId = id;

        const multiple = await wardIssueModel.getMultiple(data.itemId);
        if (data.issueQty % multiple !== 0 || data.issueQty == 0) {
            return res.status(400).json({ error: `Enter Quantity Should be Multiple of ${multiple}` });
        }

        if (!data.issueItemId || data.issueItemId == 0) {
            const isDuplicate = await wardIssueModel.checkDuplicateItem(id, data.itemId);
            if (isDuplicate) {
                return res.status(400).json({ error: "it alredy in your item list update then qty" });
            }
        }

        // Breakage vouchers don't have a "requested qty" (allotted), so we set it to issueQty
        if (!data.allotted || data.allotted == 0) {
            data.allotted = data.issueQty;
        }

        if (parseFloat(data.issueQty) > parseFloat(data.curStock)) {
            return res.status(400).json({ error: "Issue Qty cannot be greater than Stock" });
        }

        let issueItemId;
        if (!data.issueItemId || data.issueItemId == 0) {
            issueItemId = await wardIssueModel.addIssueItem(data);
        } else {
            await wardIssueModel.updateIssueItem(data);
            issueItemId = data.issueItemId;
        }

        res.json({ message: "Saved Successfully", issueItemId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateBreakageItem = async (req, res) => {
    try {
        const { issueItemId } = req.params;
        const data = req.body;
        data.issueItemId = issueItemId;

        const multiple = await wardIssueModel.getMultiple(data.itemId);
        if (data.issueQty % multiple !== 0 || data.issueQty == 0) {
            return res.status(400).json({ error: `Enter Quantity Should be Multiple of ${multiple}` });
        }

        // Breakage vouchers don't have a "requested qty" (allotted), so we set it to issueQty
        if (!data.allotted || data.allotted == 0) {
            data.allotted = data.issueQty;
        }

        if (parseFloat(data.issueQty) > parseFloat(data.curStock)) {
            return res.status(400).json({ error: "Issue Qty cannot be greater than Stock" });
        }

        await wardIssueModel.updateIssueItem(data);

        res.json({ message: "Updated Successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAvailableBatches = async (req, res) => {
    try {
        const { facilityId, itemId, issueItemId } = req.query;
        if (!facilityId || !itemId || !issueItemId) {
            return res.status(400).json({ error: "Missing parameters" });
        }
        
        const query = `
            SELECT 
                rb.BatchNo as "BatchNo",
                rb.ExpDate as "ExpDate",
                rb.MfgDate as "MfgDate",
                rb.AbsRqty as "Quantity",
                nvl(a.IssueQty,0) as "PrevIssueQty",
                (nvl(rb.AbsRqty,0) - nvl(a.IssueQty,0)) as "AvailQty",
                nvl(curr.IssueQty, 0) as "CurrentIssueQty",
                rb.inwno as "Inwno",
                rb.facreceiptitemid as "FacReceiptItemID",
                nvl(mr.locationno,'0') as "StockLocation"
            FROM tbfacilityreceiptbatches rb 
            INNER JOIN tbfacilityreceiptitems i ON rb.facreceiptitemid=i.facreceiptitemid 
            INNER JOIN tbfacilityreceipts r ON r.facreceiptid=i.facreceiptid 
            LEFT OUTER JOIN masracks mr ON mr.rackid = rb.StockLocation
            LEFT OUTER JOIN ( 
               SELECT FacilityID, sum(nvl(a.IssueQty,0)) as IssueQty, a.Inwno, a.facreceiptitemid 
               FROM tbfacilityoutwards a 
               INNER JOIN tbfacilityissueitems tbi ON tbi.issueitemid = a.issueitemid 
               INNER JOIN tbfacilityissues tb ON tb.issueid = tbi.issueid 
               WHERE tb.status IN ('C','IN') AND tb.FacilityID = :facilityId 
               GROUP BY a.Inwno, FacilityID, a.facreceiptitemid 
            ) a ON a.inwno=rb.inwno AND a.facreceiptitemid=rb.facreceiptitemid AND a.FacilityID=r.FacilityID 
            LEFT OUTER JOIN (
               SELECT sum(IssueQty) as IssueQty, Inwno, facreceiptitemid
               FROM tbfacilityoutwards
               WHERE IssueItemID = :issueItemId
               GROUP BY Inwno, facreceiptitemid
            ) curr ON curr.inwno=rb.inwno AND curr.facreceiptitemid=rb.facreceiptitemid
            WHERE (rb.Whissueblock = 0 OR rb.Whissueblock IS NULL) 
              AND r.status='C' 
              AND rb.qastatus=1 
              AND r.FacilityID=:facilityId 
              AND i.itemid=:itemId 
              AND rb.ExpDate >= SysDate 
              AND (nvl(rb.AbsRqty,0) - nvl(a.IssueQty,0) + nvl(curr.IssueQty, 0)) > 0 
            ORDER BY rb.ExpDate 
        `;
        const result = await db.execute(query, { facilityId, itemId, issueItemId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        res.json({ success: true, data: result.rows || [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.saveBatchAllocations = async (req, res) => {
    let connection;
    try {
        const { issueItemId, allocations } = req.body;
        if (!issueItemId) return res.status(400).json({ error: "issueItemId required" });

        connection = await oracledb.getConnection();

        await connection.execute("DELETE FROM tbFacilityOutwards WHERE IssueItemID = :issueItemId", { issueItemId }, { autoCommit: false });

        for (const alloc of allocations) {
            if (alloc.issueQty > 0) {
                await connection.execute(
                    "INSERT INTO tbFacilityOutwards (IssueItemID, Inwno, FacReceiptItemID, IssueQty) VALUES (:issueItemId, :inwno, :facreceiptitemid, :issueQty)",
                    {
                        issueItemId,
                        inwno: alloc.inwno,
                        facreceiptitemid: alloc.facreceiptitemid,
                        issueQty: alloc.issueQty
                    },
                    { autoCommit: false }
                );
            }
        }
        await connection.commit();
        res.json({ success: true });
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (err) { console.error(err); }
        }
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (err) { console.error(err); }
        }
    }
};;
