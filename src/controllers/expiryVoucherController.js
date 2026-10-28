const oracledb = require('oracledb');
const db = require('../config/db');

/**
 * GET /api/expiry-voucher/fin-years
 * Fetch financial years from masAccYearSettings
 */
exports.getFinancialYears = async (req, res) => {
  try {
    const query = `
      SELECT 
        AccYrSetID as "accYrSetId",
        AccYear as "accYear",
        SHAccYear as "shAccYear",
        CASE WHEN SYSDATE BETWEEN StartDate AND EndDate THEN 'Y' ELSE 'N' END as "isCurrent"
      FROM masAccYearSettings
      ORDER BY AccYrSetID DESC
    `;
    const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = (result.rows || []).map((r) => ({
      accYrSetId: r.accYrSetId || r.ACCYRSETID,
      accYear: r.accYear || r.ACCYEAR,
      shAccYear: r.shAccYear || r.SHACCYEAR,
      isCurrent: (r.isCurrent || r.ISCURRENT) === 'Y'
    }));

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching financial years:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/expiry-voucher/list
 * Fetch expired issues list for a facility and optional financial year
 */
exports.getExpiryVoucherList = async (req, res) => {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId;
    const { accYearId } = req.query;

    if (!facilityId) {
      return res.status(400).json({ success: false, message: 'Facility ID is required' });
    }

    let query = `
      SELECT 
        0 as "slNo",
        a1.IssueID as "issueId",
        a1.IssueNo as "issueNo",
        a1.IssueType as "issueType",
        CASE a1.IssueType WHEN 'EX' THEN 'Expired' ELSE 'Expired' END as "issueTypeDesc",
        TO_CHAR(a1.IssueDate, 'DD-MM-YYYY') as "issueDate",
        NVL(a1.Status, 'IN') as "status"
      FROM tbFacilityIssues a1
      LEFT JOIN masAccYearSettings m3 ON (a1.IssueDate BETWEEN m3.StartDate AND m3.EndDate)
      WHERE a1.FacilityID = :facilityId
        AND a1.IssueType = 'EX'
    `;

    const binds = { facilityId: Number(facilityId) };

    if (accYearId && accYearId !== 'all' && accYearId !== '') {
      query += ` AND m3.AccYrSetID = :accYearId`;
      binds.accYearId = Number(accYearId);
    }

    query += ` ORDER BY a1.IssueDate DESC, a1.IssueID DESC`;

    const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = (result.rows || []).map((r, index) => ({
      slNo: index + 1,
      issueId: r.issueId || r.ISSUEID,
      issueNo: r.issueNo || r.ISSUENO,
      issueType: r.issueType || r.ISSUETYPE,
      issueTypeDesc: r.issueTypeDesc || r.ISSUETYPEDESC,
      issueDate: r.issueDate || r.ISSUEDATE,
      status: r.status || r.STATUS
    }));

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching expiry voucher list:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/expiry-voucher/header
 * Fetch header details of a specific issue
 */
exports.getHeaderInfo = async (req, res) => {
  try {
    const { issueId } = req.query;
    if (!issueId || issueId === '0') {
      return res.json({
        success: true,
        data: {
          issueId: '0',
          issueNo: 'Auto generated',
          issueDate: '',
          issueType: 'EX',
          issueTypeDesc: 'Expired',
          status: 'IN'
        }
      });
    }

    const query = `
      SELECT 
        IssueID as "issueId",
        FacilityID as "facilityId",
        IssueNo as "issueNo",
        IssueType as "issueType",
        CASE IssueType WHEN 'EX' THEN 'Expired' ELSE 'Expired' END as "issueTypeDesc",
        TO_CHAR(IssueDate, 'DD-MM-YYYY') as "issueDate",
        NVL(Status, 'IN') as "status",
        Remarks as "remarks"
      FROM tbFacilityIssues
      WHERE IssueID = :issueId AND IssueType = 'EX'
    `;

    const result = await db.execute(query, { issueId: Number(issueId) }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Expiry voucher not found' });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        issueId: row.issueId || row.ISSUEID,
        facilityId: row.facilityId || row.FACILITYID,
        issueNo: row.issueNo || row.ISSUENO,
        issueType: row.issueType || row.ISSUETYPE,
        issueTypeDesc: row.issueTypeDesc || row.ISSUETYPEDESC,
        issueDate: row.issueDate || row.ISSUEDATE,
        status: row.status || row.STATUS,
        remarks: row.remarks || row.REMARKS || ''
      }
    });
  } catch (error) {
    console.error('Error fetching header:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Helper: Generate next issue number (<FacilityCode>/EX/<5-digit seq>/<AccYear>)
 */
async function generateNextIssueNo(facilityId, issueDateStr) {
  // 1. Get facility code
  const facRes = await db.execute(
    'SELECT FacilityCode FROM masFacilities WHERE FacilityID = :facilityId',
    { facilityId: Number(facilityId) },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  if (!facRes.rows || facRes.rows.length === 0) {
    throw new Error('Facility not found');
  }
  const facilityCode = facRes.rows[0].FACILITYCODE || facRes.rows[0].FacilityCode;

  // 2. Get accounting year code (SHAccYear)
  let accYearQuery = `
    SELECT SHAccYear FROM masAccYearSettings 
    WHERE TO_DATE(:issueDate, 'DD-MM-YYYY') BETWEEN StartDate AND EndDate
  `;
  let accYearRes = await db.execute(
    accYearQuery,
    { issueDate: issueDateStr },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  let shAccYear = '';
  if (accYearRes.rows && accYearRes.rows.length > 0) {
    shAccYear = accYearRes.rows[0].SHACCYEAR || accYearRes.rows[0].SHAccYear;
  } else {
    // Fallback based on year/month
    const parts = issueDateStr.split('-');
    const year = parseInt(parts[2], 10);
    const month = parseInt(parts[1], 10);
    shAccYear = month >= 4
      ? `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`
      : `${String(year - 1).slice(-2)}-${String(year).slice(-2)}`;
  }

  // 3. Get next sequence
  const pattern = `${facilityCode}/EX/%/${shAccYear}`;
  const seqQuery = `
    SELECT LPAD(
      NVL(MAX(
        CASE WHEN REGEXP_LIKE(SUBSTR(IssueNo, -11, 5), '^[0-9]+$')
             THEN TO_NUMBER(SUBSTR(IssueNo, -11, 5))
             ELSE 0 END
      ), 0) + 1,
      5,
      '0'
    ) AS NEXTSEQ
    FROM tbFacilityIssues
    WHERE IssueNo LIKE :pattern
  `;
  const seqRes = await db.execute(seqQuery, { pattern }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  let nextSeq = '00001';
  if (seqRes.rows && seqRes.rows.length > 0) {
    nextSeq = seqRes.rows[0].NEXTSEQ || seqRes.rows[0].nextSeq || '00001';
  }

  return `${facilityCode}/EX/${nextSeq}/${shAccYear}`;
}

/**
 * POST /api/expiry-voucher/save-header
 * Save header and automatically find & populate expired items/batches
 */
exports.saveHeader = async (req, res) => {
  let connection;
  try {
    const facilityId = req.body.facilityId || req.user?.facilityId;
    const { issueDate } = req.body;
    let issueId = req.body.issueId ? String(req.body.issueId) : '0';

    if (!facilityId) {
      return res.status(400).json({ success: false, message: 'Facility ID is required' });
    }
    if (!issueDate || !issueDate.trim()) {
      return res.status(400).json({ success: false, message: 'Reference Date is required' });
    }

    const datePattern = /^\d{2}-\d{2}-\d{4}$/;
    if (!datePattern.test(issueDate.trim())) {
      return res.status(400).json({ success: false, message: 'Invalid Date format. Expected DD-MM-YYYY' });
    }

    connection = await oracledb.getConnection();

    let finalIssueNo = '';

    if (issueId === '0' || !issueId) {
      // 1. Generate new issue number
      finalIssueNo = await generateNextIssueNo(facilityId, issueDate.trim());

      // 2. Insert into tbFacilityIssues
      const maxIdRes = await connection.execute(
        'SELECT NVL(MAX(IssueID), 0) + 1 AS NEWID FROM tbFacilityIssues',
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const newIssueId = maxIdRes.rows[0].NEWID || maxIdRes.rows[0].newId;

      const insertIssueQuery = `
        INSERT INTO tbFacilityIssues (
          IssueID, FacilityID, IssueNo, IssueDate, IssueType, Status
        ) VALUES (
          :issueId, :facilityId, :issueNo, TO_DATE(:issueDate, 'DD-MM-YYYY'), 'EX', 'IN'
        )
      `;
      await connection.execute(
        insertIssueQuery,
        {
          issueId: Number(newIssueId),
          facilityId: Number(facilityId),
          issueNo: finalIssueNo,
          issueDate: issueDate.trim()
        },
        { autoCommit: false }
      );

      issueId = String(newIssueId);
    } else {
      // Update existing issue date
      const updateIssueQuery = `
        UPDATE tbFacilityIssues
        SET IssueDate = TO_DATE(:issueDate, 'DD-MM-YYYY')
        WHERE IssueID = :issueId AND IssueType = 'EX'
      `;
      await connection.execute(
        updateIssueQuery,
        {
          issueDate: issueDate.trim(),
          issueId: Number(issueId)
        },
        { autoCommit: false }
      );

      const curRes = await connection.execute(
        'SELECT IssueNo FROM tbFacilityIssues WHERE IssueID = :issueId',
        { issueId: Number(issueId) },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (curRes.rows && curRes.rows.length > 0) {
        finalIssueNo = curRes.rows[0].ISSUENO || curRes.rows[0].IssueNo;
      }
    }

    // 3. Automatically populate expired items (IssueItems logic matching legacy ExpireFAC.aspx.cs)
    const expiredItemsQuery = `
      SELECT DISTINCT RNum, facreceiptitemid, itemid, SUM(currentstock) AS CurStock FROM (
        SELECT DISTINCT 
          ROW_NUMBER() OVER (ORDER BY a1.itemid) AS RNum,
          a3.facreceiptid,
          a1.facreceiptitemid,
          a1.itemid,
          a4.mfgdate,
          a4.expdate,
          a4.inwno,
          a4.absrqty,
          NVL(x.issueqty, 0) AS issueqty,
          (NVL(a4.absrqty, 0) - NVL(x.issueqty, 0)) AS currentstock
        FROM tbFacilityReceipts a3 
        INNER JOIN tbFacilityReceiptItems a1 ON a1.FacReceiptID = a3.FacReceiptID 
        INNER JOIN tbFacilityReceiptBatches a4 ON a4.facreceiptitemid = a1.facreceiptitemid
        LEFT OUTER JOIN (
          SELECT tbo.inwno, SUM(tbo.issueqty) AS issueqty
          FROM tbFacilityIssues tb
          INNER JOIN tbFacilityIssueItems tbi ON tbi.issueid = tb.issueid
          INNER JOIN tbFacilityOutwards tbo ON tbo.issueitemid = tbi.issueitemid
          GROUP BY tbo.inwno
        ) x ON x.inwno = a4.inwno
        WHERE a3.FacilityID = :facilityId
          AND a3.status = 'C'
          AND a4.expdate < TO_DATE(:issueDate, 'DD-MM-YYYY')
          AND (NVL(a4.absrqty, 0) - NVL(x.issueqty, 0)) > 0
      ) 
      WHERE RNum <= 20 
      GROUP BY RNum, facreceiptitemid, itemid 
      ORDER BY RNum
    `;

    const expiredRes = await connection.execute(
      expiredItemsQuery,
      {
        facilityId: Number(facilityId),
        issueDate: issueDate.trim()
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const expiredRows = expiredRes.rows || [];

    for (const expItem of expiredRows) {
      const itemId = expItem.ITEMID || expItem.itemid;
      const facReceiptItemId = expItem.FACRECEIPTITEMID || expItem.facreceiptitemid;
      const curStock = expItem.CURSTOCK || expItem.curStock;

      // Check if already in tbFacilityIssueItems
      const checkItemSql = `
        SELECT IssueItemID FROM tbFacilityIssueItems
        WHERE IssueID = :issueId AND ItemID = :itemId AND FacReceiptItemID = :facReceiptItemId
      `;
      const itemExistRes = await connection.execute(
        checkItemSql,
        {
          issueId: Number(issueId),
          itemId: Number(itemId),
          facReceiptItemId: Number(facReceiptItemId)
        },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      let issueItemId;

      if (itemExistRes.rows && itemExistRes.rows.length > 0) {
        issueItemId = itemExistRes.rows[0].ISSUEITEMID || itemExistRes.rows[0].issueItemId;
        await connection.execute(
          `UPDATE tbFacilityIssueItems
           SET CurrentStock = :curStock, IssueQty = :curStock, Allotted = :curStock
           WHERE IssueItemID = :issueItemId`,
          { curStock: Number(curStock), issueItemId: Number(issueItemId) },
          { autoCommit: false }
        );
      } else {
        // Get next IssueItemID
        const maxItemRes = await connection.execute(
          'SELECT NVL(MAX(IssueItemID), 0) + 1 AS NEWITEMID FROM tbFacilityIssueItems',
          {},
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        issueItemId = maxItemRes.rows[0].NEWITEMID || maxItemRes.rows[0].newItemId;

        await connection.execute(
          `INSERT INTO tbFacilityIssueItems (
             IssueItemID, IssueID, ItemID, FacReceiptItemID, CurrentStock, IssueQty, Allotted
           ) VALUES (
             :issueItemId, :issueId, :itemId, :facReceiptItemId, :curStock, :curStock, :curStock
           )`,
          {
            issueItemId: Number(issueItemId),
            issueId: Number(issueId),
            itemId: Number(itemId),
            facReceiptItemId: Number(facReceiptItemId),
            curStock: Number(curStock)
          },
          { autoCommit: false }
        );

        // Fetch batches for outwards insertion
        const batchQuery = `
          SELECT 
            a3.facreceiptid, a1.facreceiptitemid, a1.itemid, a4.mfgdate, a4.expdate, a4.inwno, a4.absrqty,
            NVL(x.issueqty, 0) AS issueqty,
            (NVL(a4.absrqty, 0) - NVL(x.issueqty, 0)) AS currentstock
          FROM tbFacilityReceipts a3 
          INNER JOIN tbFacilityReceiptItems a1 ON a1.FacReceiptID = a3.FacReceiptID 
          INNER JOIN tbFacilityReceiptBatches a4 ON a4.facreceiptitemid = a1.facreceiptitemid
          LEFT OUTER JOIN (
            SELECT tbo.inwno, SUM(tbo.issueqty) AS issueqty
            FROM tbFacilityIssues tb
            INNER JOIN tbFacilityIssueItems tbi ON tbi.issueid = tb.issueid
            INNER JOIN tbFacilityOutwards tbo ON tbo.issueitemid = tbi.issueitemid
            GROUP BY tbo.inwno
          ) x ON x.inwno = a4.inwno
          WHERE a3.FacilityID = :facilityId 
            AND a3.status = 'C' 
            AND a1.itemid = :itemId 
            AND a1.facreceiptitemid = :facReceiptItemId 
            AND a4.expdate < TO_DATE(:issueDate, 'DD-MM-YYYY') 
            AND (NVL(a4.absrqty, 0) - NVL(x.issueqty, 0)) > 0
        `;

        const batchRes = await connection.execute(
          batchQuery,
          {
            facilityId: Number(facilityId),
            itemId: Number(itemId),
            facReceiptItemId: Number(facReceiptItemId),
            issueDate: issueDate.trim()
          },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        for (const b of (batchRes.rows || [])) {
          const inwNo = b.INWNO || b.inwno;
          const bStock = b.CURRENTSTOCK || b.currentstock;
          if (bStock > 0) {
            await connection.execute(
              `INSERT INTO tbFacilityOutwards (
                 IssueItemID, ItemID, FacReceiptItemID, IssueQty, Issued, Status, InwNo
               ) VALUES (
                 :issueItemId, :itemId, :facReceiptItemId, :bStock, 1, 'IN', :inwNo
               )`,
              {
                issueItemId: Number(issueItemId),
                itemId: Number(itemId),
                facReceiptItemId: Number(facReceiptItemId),
                bStock: Number(bStock),
                inwNo: Number(inwNo)
              },
              { autoCommit: false }
            );
          }
        }
      }
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Saved successfully',
      data: {
        issueId,
        issueNo: finalIssueNo,
        expiredItemsCount: expiredRows.length
      }
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (err) { console.error('Rollback error:', err); }
    }
    console.error('Error saving expiry header:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { console.error('Close error:', err); }
    }
  }
};

/**
 * GET /api/expiry-voucher/items
 * Fetch expired items and batches for the issue grid
 */
exports.getItems = async (req, res) => {
  try {
    const { issueId } = req.query;
    if (!issueId || issueId === '0') {
      return res.json({ success: true, data: [] });
    }

    const query = `
      SELECT 
        0 as "slNo",
        tb.IssueID as "issueId",
        m.ItemCode as "itemCode",
        m.ItemName as "itemName",
        m.Strength1 as "strength",
        tbi.ItemID as "itemId",
        tbi.IssueItemID as "issueItemId",
        tbi.Remarks as "remarks",
        rb.BatchNo as "batchNo",
        TO_CHAR(rb.MfgDate, 'DD-MM-YYYY') as "mfgDate",
        TO_CHAR(rb.ExpDate, 'DD-MM-YYYY') as "expDate",
        tbo.InwNo as "inwNo",
        tbo.IssueQty as "expiredQty"
      FROM tbFacilityIssues tb
      INNER JOIN tbFacilityIssueItems tbi ON tbi.IssueID = tb.IssueID
      INNER JOIN tbFacilityOutwards tbo ON tbo.IssueItemID = tbi.IssueItemID
      INNER JOIN tbFacilityReceiptBatches rb ON rb.InwNo = tbo.InwNo
      INNER JOIN masItems m ON m.ItemID = tbi.ItemID  
      WHERE tb.IssueID = :issueId
      ORDER BY m.ItemCode, rb.BatchNo
    `;

    const result = await db.execute(query, { issueId: Number(issueId) }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = (result.rows || []).map((r, idx) => ({
      slNo: idx + 1,
      issueId: r.issueId || r.ISSUEID,
      itemCode: r.itemCode || r.ITEMCODE,
      itemName: r.itemName || r.ITEMNAME,
      strength: r.strength || r.STRENGTH || '',
      itemId: r.itemId || r.ITEMID,
      issueItemId: r.issueItemId || r.ISSUEITEMID,
      remarks: r.remarks || r.REMARKS || '',
      batchNo: r.batchNo || r.BATCHNO,
      mfgDate: r.mfgDate || r.MFGDATE || '',
      expDate: r.expDate || r.EXPDATE || '',
      inwNo: r.inwNo || r.INWNO,
      expiredQty: r.expiredQty || r.EXPIREDQTY || 0
    }));

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching expired items:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/expiry-voucher/complete
 * Save remarks and complete the expired voucher
 */
exports.completeVoucher = async (req, res) => {
  let connection;
  try {
    const { issueId, remarksMap } = req.body;
    if (!issueId || issueId === '0') {
      return res.status(400).json({ success: false, message: 'Valid Issue ID is required' });
    }

    connection = await oracledb.getConnection();

    // 1. Update remarks on tbFacilityIssueItems
    if (remarksMap && typeof remarksMap === 'object') {
      for (const [issueItemId, remark] of Object.entries(remarksMap)) {
        await connection.execute(
          `UPDATE tbFacilityIssueItems
           SET Remarks = :remark
           WHERE IssueItemID = :issueItemId`,
          { remark: remark ? String(remark).trim() : '', issueItemId: Number(issueItemId) },
          { autoCommit: false }
        );
      }
    }

    // 2. Complete tbFacilityIssues and tbFacilityOutwards
    await connection.execute(
      `UPDATE tbFacilityIssues
       SET Status = 'C'
       WHERE IssueID = :issueId`,
      { issueId: Number(issueId) },
      { autoCommit: false }
    );

    await connection.execute(
      `UPDATE tbFacilityOutwards
       SET Status = 'C'
       WHERE IssueItemID IN (
         SELECT IssueItemID FROM tbFacilityIssueItems WHERE IssueID = :issueId
       )`,
      { issueId: Number(issueId) },
      { autoCommit: false }
    );

    await connection.commit();

    res.json({ success: true, message: 'Voucher completed successfully' });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (err) { console.error('Rollback error:', err); }
    }
    console.error('Error completing expiry voucher:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { console.error('Close error:', err); }
    }
  }
};

/**
 * DELETE /api/expiry-voucher/:issueId
 * Delete an incomplete expiry voucher
 */
exports.deleteVoucher = async (req, res) => {
  let connection;
  try {
    const { issueId } = req.params;
    if (!issueId || issueId === '0') {
      return res.status(400).json({ success: false, message: 'Valid Issue ID is required' });
    }

    connection = await oracledb.getConnection();

    // Check if status is complete
    const checkRes = await connection.execute(
      'SELECT Status FROM tbFacilityIssues WHERE IssueID = :issueId',
      { issueId: Number(issueId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!checkRes.rows || checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Voucher not found' });
    }

    const curStatus = checkRes.rows[0].STATUS || checkRes.rows[0].status;
    if (curStatus === 'C') {
      return res.status(400).json({ success: false, message: 'Completed voucher cannot be deleted' });
    }

    // Delete outwards -> issue items -> issue header
    await connection.execute(
      `DELETE FROM tbFacilityOutwards 
       WHERE IssueItemID IN (
         SELECT IssueItemID FROM tbFacilityIssueItems WHERE IssueID = :issueId
       )`,
      { issueId: Number(issueId) },
      { autoCommit: false }
    );

    await connection.execute(
      `DELETE FROM tbFacilityIssueItems WHERE IssueID = :issueId`,
      { issueId: Number(issueId) },
      { autoCommit: false }
    );

    await connection.execute(
      `DELETE FROM tbFacilityIssues WHERE IssueID = :issueId`,
      { issueId: Number(issueId) },
      { autoCommit: false }
    );

    await connection.commit();

    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (err) { console.error('Rollback error:', err); }
    }
    console.error('Error deleting expiry voucher:', error);
    res.status(500).json({ success: false, message: 'References found and cannot be deleted.' });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { console.error('Close error:', err); }
    }
  }
};
