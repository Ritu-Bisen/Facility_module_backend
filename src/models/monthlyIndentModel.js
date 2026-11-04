const db = require('../config/db');
const oracledb = require('oracledb');

/**
 * Fetch the list of Monthly Indent / NOC requests for a facility.
 * Mirrors PopulateSO() from CgmsclNocMainDHS.aspx.cs
 */
async function getNocList(facilityId, accYrSetId, status) {
  let statusClause = '';
  let yearClause = 'AND a.ACCYRSETID = :accYrSetId';
  const binds = { facilityId, accYrSetId };

  if (status && status !== 'All') {
    // Map frontend labels to DB single-char codes
    const statusMap = { Incomplete: 'I', Completed: 'C', Complete: 'C', Approved: 'A', Sent: 'S' };
    const dbStatus = statusMap[status] || status;
    statusClause = `AND a.Status = :status`;
    binds.status = dbStatus;

    // Show all incomplete NOCs regardless of selected year so user can find and delete them
    if (dbStatus === 'I') {
      yearClause = '';
      delete binds.accYrSetId;
    }
  }

  const query = `
    SELECT
      a.NOCID,
      a.NOCNumber,
      TO_CHAR(a.NOCDATE, 'dd-mm-yyyy') AS NOCDATE,
      CASE a.Status
        WHEN 'A' THEN 'Approved'
        WHEN 'I' THEN 'Incomplete'
        WHEN 'S' THEN 'Sent for Approval'
        WHEN 'C' THEN 'Completed'
        WHEN 'D' THEN 'Deleted'
      END AS STATUS,
      a.NOCSTATUS,
      a.DispatchNo,
      TO_CHAR(a.DispatchDate, 'dd-mm-yyyy') AS DISPATCHDATE,
      c.AccYear,
      a.facilityID
    FROM MASCGMSCNOC a
    LEFT JOIN MASACCYEARSETTINGS c ON a.ACCYRSETID = c.ACCYRSETID
    WHERE a.INDENTTYPE IS NULL
      ${yearClause}
      AND a.FACILITYID = :facilityId
      ${statusClause}
    ORDER BY a.NOCDATE DESC, a.NOCID DESC
  `;

  const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows;
}

/**
 * Get incomplete NOC entry for the facility.
 * Mirrors GetIncomplete() from CgmsclNocMainDHS.aspx.cs
 */
async function getIncompleteNoc(facilityId) {
  const query = `
    SELECT NOCID, NOCNumber, NOCDATE
    FROM MASCGMSCNOC
    WHERE STATUS = 'I'
      AND FACILITYID = :facilityId
      AND INDENTTYPE IS NULL
    ORDER BY NOCID DESC
  `;
  const result = await db.execute(query, { facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Generate a new NOC/Indent number for the facility.
 * Pattern: FCODE/NC/<serial>/<shAccYear>
 */
async function generateNocNumber(facilityId) {
  // Step 1: (Skipped) Using facilityId directly instead of FacilityCode

  // Step 2: Get current financial year
  const yearResult = await db.execute(
    `SELECT SHAccYear FROM masAccYearSettings WHERE SYSDATE BETWEEN StartDate AND EndDate AND ROWNUM = 1`,
    {},
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  let shAccYear;
  if (!yearResult.rows || yearResult.rows.length === 0) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    shAccYear = month >= 3
      ? `${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`
      : `${(year - 1).toString().slice(-2)}-${year.toString().slice(-2)}`;
  } else {
    shAccYear = yearResult.rows[0].SHACCYEAR;
  }

  // Step 3: Get next serial number
  const pattern = `${facilityId}/NC%/${shAccYear}`;
  const serialResult = await db.execute(
    `SELECT LPAD(
       NVL(MAX(TO_NUMBER(
         SUBSTR(
           NOCNumber,
           INSTR(NOCNumber, '/NC') + 3,
           5
         )
       )), 0) + 1,
       5, '0'
     ) AS NOCSLNO
     FROM MASCGMSCNOC
     WHERE NOCNumber LIKE :pattern`,
    { pattern },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  const serial = serialResult.rows[0].NOCSLNO;

  // Step 4: Construct number: e.g. 23246/NC00012/26-27
  return `${facilityId}/NC${serial}/${shAccYear}`;
}

/**
 * Get all available programs.
 */
async function getPrograms() {
  const query = `
    SELECT PROGRAMID, PROGRAM as PROGRAMNAME
    FROM MASPROGRAM
    ORDER BY PROGRAM
  `;
  const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows;
}

/**
 * Get all available item categories.
 */
async function getItemCategories() {
  const query = `
    SELECT MCID, MCATEGORY
    FROM MASITEMMAINCATEGORY
    ORDER BY MCID
  `;
  const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows;
}

/**
 * Get all available item types.
 */
async function getItemTypes() {
  const query = `
    SELECT ITEMTYPEID, ITEMTYPENAME
    FROM MASITEMTYPES
    ORDER BY ITEMTYPENAME
  `;
  const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows;
}

/**
 * Create a new NOC header record.
 */
async function createNocHeader({ facilityId, accYrSetId, nocNumber, nocDate, programId }) {
  const query = `
    INSERT INTO MASCGMSCNOC
      (FACILITYID, ACCYRSETID, NOCNUMBER, NOCDATE, STATUS, INDENTTYPE, PROGRAMID)
    VALUES
      (:facilityId, :accYrSetId, :nocNumber,
       TO_DATE(:nocDate, 'dd-mm-yyyy'), 'I', NULL, :programId)
    RETURNING NOCID INTO :nocId
  `;
  const binds = {
    facilityId,
    accYrSetId,
    nocNumber,
    nocDate,
    programId: programId || null,
    nocId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
  };
  const result = await db.execute(query, binds, { autoCommit: true });
  return result.outBinds.nocId[0];
}

/**
 * Update an existing NOC header.
 */
async function updateNocHeader({ nocId, nocDate, programId, accYrSetId }) {
  const query = `
    UPDATE MASCGMSCNOC
    SET NOCDATE = TO_DATE(:nocDate, 'dd-mm-yyyy'),
        PROGRAMID = :programId,
        ACCYRSETID = :accYrSetId
    WHERE NOCID = :nocId
  `;
  await db.execute(query, { nocId, nocDate, programId: programId || null, accYrSetId }, { autoCommit: true });
}

/**
 * Delete a NOC request and all its items.
 * Mirrors btnDelete_Click from CgmsclNocDHS.aspx.cs
 */
async function deleteNoc(nocId) {
  const checkIndentQuery = `SELECT NOCID FROM TBINDENTS WHERE NOCID = :nocId`;
  const refRes = await db.execute(checkIndentQuery, { nocId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  if (refRes.rows && refRes.rows.length > 0) {
    throw new Error("Reference Found. Cannot delete NOC.");
  }

  await db.execute(
    `DELETE FROM MASCGMSCNOCITEMS WHERE NOCID = :nocId`,
    { nocId },
    { autoCommit: false }
  );
  await db.execute(
    `DELETE FROM MASCGMSCNOC WHERE NOCID = :nocId`,
    { nocId },
    { autoCommit: true }
  );
}

/**
 * Complete a NOC request (set status to 'C').
 * Mirrors btnComplete_Click from CgmsclNocDHS.aspx.cs
 */
async function completeNoc(nocId) {
  const appCheck = `SELECT SR FROM MASCGMSCNOCITEMS WHERE NVL(APPROVEDQTY, 0) > 0 AND NOCID = :nocId`;
  const appRes = await db.execute(appCheck, { nocId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  if (appRes.rows && appRes.rows.length > 0) {
    throw new Error("Automatic NOC Process has been blocked, You may Contact/Letter to Central Store DHS with the Requirement");
  }

  const countCheck = `SELECT COUNT(*) AS CNT FROM MASCGMSCNOCITEMS WHERE NOCID = :nocId`;
  const countRes = await db.execute(countCheck, { nocId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  if (!countRes.rows || countRes.rows[0].CNT === 0) {
    throw new Error("Please enter Item details first.");
  }

  await db.execute(
    `UPDATE MASCGMSCNOC SET STATUS = 'C', NOCDATE = SYSDATE WHERE NOCID = :nocId`,
    { nocId },
    { autoCommit: true }
  );
}

/**
 * Check if a completed NOC has indent/NOC quantities.
 * Mirrors CheckNOC_Indent() from CgmsclNocMainDHS.aspx.cs
 */
async function checkNocIndent(nocId, facilityId) {
  const query = `
    SELECT
      NVL(SUM(NVL(b.BOOKEDQTY, 0)), 0) AS INDENT,
      NVL(SUM(NVL(b.APPROVEDQTY, 0)), 0) AS NOC
    FROM MASCGMSCNOCITEMS b
    INNER JOIN MASCGMSCNOC m ON m.NOCID = b.NOCID
    WHERE m.FACILITYID = :facilityId
      AND b.NOCID = :nocId
  `;
  const result = await db.execute(query, { nocId, facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows[0] || { INDENT: 0, NOC: 0 };
}

/**
 * Get the NOC header by ID.
 */
async function getNocById(nocId) {
  const query = `
    SELECT
      a.NOCID, a.NOCNUMBER, a.FACILITYID, a.ACCYRSETID,
      TO_CHAR(a.NOCDATE, 'dd-mm-yyyy') AS NOCDATE,
      a.STATUS, a.NOCSTATUS, a.PROGRAMID,
      p.PROGRAM as PROGRAMNAME,
      c.AccYear
    FROM MASCGMSCNOC a
    JOIN MASACCYEARSETTINGS c ON a.ACCYRSETID = c.ACCYRSETID
    LEFT JOIN MASPROGRAM p ON a.PROGRAMID = p.PROGRAMID
    WHERE a.NOCID = :nocId
  `;
  const result = await db.execute(query, { nocId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Get NOC items for a given NOCID.
 * For DHS facilities (!isMC), executes the exact PopulateItems query from CgmsclNocDHS.aspx.cs.
 */
async function getNocItems(nocId, facilityId = null, isMC = false) {
  const safeNocId = Number(nocId) || nocId;
  const safeFacId = facilityId ? (Number(facilityId) || facilityId) : null;

  if (!isMC && safeFacId) {
    try {
      const dhsQuery = `
        SELECT 
          0 AS SlNo,
          b.SR,
          b.SR AS NOCITEMID,
          b.ItemID,
          mi.ITEMCODE,
          mi.ITEMNAME,
          mi.STRENGTH1,
          mi.UNIT,
          NVL(mi.UNITCOUNT, 1) AS UNITCOUNT,
          mi.EDL,
          b.requestedqty * NVL(mi.unitcount, 1) AS AbsQty,
          b.requestedqty * NVL(mi.unitcount, 1) AS REQUESTEDQTY,
          a.status AS STATUS,
          a.NocId AS NOCID,
          a.Remarks AS NOCREMARKS,
          NVL(b.whStock, 0) * NVL(mi.unitcount, 1) AS WHStock,
          b.ItemRemarks AS ITEMREMARKS,
          b.ItemRemarks AS REMARKS,
          NVL(b.WHStockQCPending, 0) * NVL(mi.unitcount, 1) AS WHStockQCPending,
          TO_CHAR(b.EstimatedDate, 'dd-mm-yyyy') AS EstimatedDate,
          b.CgmsclRemarks AS CGMSCLRemarks,
          b.WHID,
          NVL(b.Otherwhstock, 0) AS Otherwhstock,
          NVL(b.approvedqty, 0) * NVL(mi.unitcount, 1) AS APPROVEDQTY,
          NVL(b.BookedQTY, 0) * NVL(mi.unitcount, 1) AS BOOKEDQTY,
          NVL(b.STOCKINHAND, 0) AS STOCKINHAND,
          NVL(ind.Indentqty, 0) AS AIQTY,
          NVL(ind.issueqty, 0) AS WHISSUEQTY,
          NVL(ind.NOcQty, 0) AS NOCQTY,
          NVL(ind.BalIndentqty, 0) AS BALAIQTY,
          NVL(ind.TranIssueQty, 0) AS TRANISSUEQTY,
          NVL(ind.TranQtyRecv, 0) AS TRANQTYRECV
        FROM MASCGMSCNOC a
        INNER JOIN MASCGMSCNOCITEMS b ON a.nocid = b.nocid
        INNER JOIN masitems mi ON mi.ItemID = b.ItemID 
        LEFT OUTER JOIN 
        (
          SELECT 
            m.itemid,
            NVL(II.Indentqty, 0) AS Indentqty,
            NVL(Iss.issueqty, 0) * NVL(m.unitcount, 1) AS issueqty,
            NVL(Noc.NOcQty, 0) * NVL(m.unitcount, 1) AS NOcQty,
            (NVL(II.Indentqty, 0) + NVL(ITR.TranQtyRecv, 0)) AS totRecv,
            ((((NVL(Iss.issueqty, 0) + NVL(Noc.NOcQty, 0))) * NVL(m.unitcount, 1)) + NVL(ITI.TranIssueQty, 0)) AS toIssue,
            NVL((NVL(II.Indentqty, 0) + NVL(ITR.TranQtyRecv, 0)) - ((((NVL(Iss.issueqty, 0) + NVL(Noc.NOcQty, 0))) * NVL(m.unitcount, 1)) + NVL(ITI.TranIssueQty, 0)), 0) AS BalIndentqty,
            NVL(ITR.TranQtyRecv, 0) AS TranQtyRecv,
            NVL(ITI.TranIssueQty, 0) AS TranIssueQty 
          FROM MASCGMSCNOC mn 
          INNER JOIN MASCGMSCNOCITEMS mni ON mni.nocid = mn.nocid 
          INNER JOIN masitems m ON m.ItemID = mni.ItemID 
          LEFT OUTER JOIN (
            SELECT ai.itemid, SUM(ROUND(NVL(ai.cmhodistqty, 0), 0)) AS Indentqty, MAX(NVL(m.unitcount, 1)) AS unitcount
            FROM masanualindent ma
            INNER JOIN anualindent ai ON ai.indentid = ma.indentid
            INNER JOIN masitems m ON m.itemid = ai.itemid
            WHERE ai.status = 'C' AND ma.status = 'C' AND ai.facilityid = :facilityId 
              AND ai.accyrsetid IN (SELECT accyrsetid FROM masaccyearsettings WHERE sysdate BETWEEN startdate AND enddate)
              AND NVL(ai.cmhodistqty, 0) > 0 
            GROUP BY ai.itemid
          ) II ON II.itemid = m.itemid
          LEFT OUTER JOIN 
          (
            SELECT tb.facilityid, tbi.itemid, SUM(tbo.issueqty) AS issueqty 
            FROM tbindents tb
            INNER JOIN tbindentitems tbi ON tbi.indentid = tb.indentid
            INNER JOIN tboutwards tbo ON tbo.indentitemid = tbi.indentitemid
            WHERE tb.facilityid = :facilityId AND tb.status = 'C' 
              AND tb.indentdate BETWEEN (SELECT startdate FROM masaccyearsettings WHERE sysdate BETWEEN startdate AND enddate AND ROWNUM = 1) 
                                    AND (SELECT enddate FROM masaccyearsettings WHERE sysdate BETWEEN startdate AND enddate AND ROWNUM = 1)
            GROUP BY tb.facilityid, tbi.itemid 
          ) Iss ON Iss.itemid = m.itemid
          LEFT OUTER JOIN 
          (
            SELECT mn.facilityid, mni.itemid, SUM(mni.approvedqty) AS NOcQty 
            FROM mascgmscnoc mn 
            INNER JOIN mascgmscnocitems mni ON mni.nocid = mn.nocid
            WHERE mn.status = 'C' AND mn.facilityid = :facilityId 
              AND mn.nocdate BETWEEN (SELECT startdate FROM masaccyearsettings WHERE sysdate BETWEEN startdate AND enddate AND ROWNUM = 1) 
                                 AND (SELECT enddate FROM masaccyearsettings WHERE sysdate BETWEEN startdate AND enddate AND ROWNUM = 1)
            GROUP BY mn.facilityid, mni.itemid 
          ) Noc ON Noc.itemid = m.itemid
          LEFT OUTER JOIN 
          (
            SELECT itemid, SUM(NVL(transferqty, 0)) AS TranQtyRecv
            FROM (
              SELECT ai.transferqty, ai.itemid, a.facilityid
              FROM MASFACILITYAITRANSFER a
              INNER JOIN facilityaitransferitems ai ON ai.aitransferid = a.aitransferid
              WHERE a.status = 'C' AND a.accyrsetid IN (SELECT accyrsetid FROM masaccyearsettings WHERE sysdate BETWEEN startdate AND enddate)
                AND a.facilityid = :facilityId 
            ) GROUP BY itemid
          ) ITR ON ITR.itemid = m.itemid
          LEFT OUTER JOIN 
          (
            SELECT itemid, SUM(NVL(transferqty, 0)) AS TranIssueQty
            FROM (
              SELECT ai.transferqty, ai.itemid, ai.fromfacilityid AS facilityid
              FROM MASFACILITYAITRANSFER a
              INNER JOIN facilityaitransferitems ai ON ai.aitransferid = a.aitransferid
              WHERE a.status = 'C' AND a.accyrsetid IN (SELECT accyrsetid FROM masaccyearsettings WHERE sysdate BETWEEN startdate AND enddate)
                AND ai.fromfacilityid = :facilityId 
            ) GROUP BY itemid
          ) ITI ON ITI.itemid = m.itemid 
          WHERE mn.nocid = :nocId
        ) ind ON ind.itemid = b.itemid
        WHERE a.nocid = b.nocid AND a.NOCID = :nocId 
        ORDER BY b.sr
      `;
      const res = await db.execute(dhsQuery, { nocId: safeNocId, facilityId: safeFacId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (res && res.rows) {
        return res.rows;
      }
    } catch (dhsErr) {
      console.warn('dhsQuery in getNocItems failed, falling back to direct query:', dhsErr.message);
    }
  }

  const query = `
    SELECT
      b.SR as NOCITEMID,
      b.SR,
      b.NOCID,
      b.ITEMID,
      m.ITEMCODE,
      m.ITEMNAME,
      m.STRENGTH1,
      m.UNIT,
      NVL(m.UNITCOUNT, 1) AS UNITCOUNT,
      m.EDL,
      b.REQUESTEDQTY * NVL(m.UNITCOUNT, 1) AS REQUESTEDQTY,
      b.REQUESTEDQTY * NVL(m.UNITCOUNT, 1) AS ABSQTY,
      NVL(b.WHSTOCK, 0) * NVL(m.UNITCOUNT, 1) AS WHSTOCK,
      NVL(b.WHSTOCKQCPENDING, 0) * NVL(m.UNITCOUNT, 1) AS WHSTOCKQCPENDING,
      NVL(b.OTHERWHSTOCK, 0) AS OTHERWHSTOCK,
      TO_CHAR(b.ESTIMATEDDATE, 'dd-mm-yyyy') AS ESTIMATEDDATE,
      NVL(b.BOOKEDQTY, 0) * NVL(m.UNITCOUNT, 1) AS BOOKEDQTY,
      NVL(b.APPROVEDQTY, 0) * NVL(m.UNITCOUNT, 1) AS APPROVEDQTY,
      NVL(b.STOCKINHAND, 0) AS STOCKINHAND,
      b.ITEMREMARKS as REMARKS,
      b.ITEMREMARKS,
      b.CGMSCLREMARKS
    FROM MASCGMSCNOCITEMS b
    LEFT OUTER JOIN MASITEMS m ON m.ITEMID = b.ITEMID
    WHERE b.NOCID = :nocId
    ORDER BY b.SR
  `;
  const result = await db.execute(query, { nocId: safeNocId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  
  if (safeFacId && result.rows && result.rows.length > 0) {
    for (let row of result.rows) {
      try {
        const stockDetails = await getItemStockDetails(safeFacId, row.ITEMID, isMC);
        if (row.WHSTOCK === null || row.WHSTOCK === undefined) row.WHSTOCK = stockDetails.whStock;
        if (row.WHSTOCKQCPENDING === null || row.WHSTOCKQCPENDING === undefined) row.WHSTOCKQCPENDING = stockDetails.qcStock;
        if (row.OTHERWHSTOCK === null || row.OTHERWHSTOCK === undefined) row.OTHERWHSTOCK = stockDetails.otherWhStock;
        if (!row.ESTIMATEDDATE) row.ESTIMATEDDATE = stockDetails.estDate;
        row.AIQTY = stockDetails.aiQty ?? 0;
        row.WHISSUEQTY = stockDetails.whIssueQty ?? 0;
        row.NOCQTY = stockDetails.nocQty ?? 0;
        row.BALAIQTY = stockDetails.balAiQty ?? 0;
        row.TRANISSUEQTY = stockDetails.tranIssueQty ?? 0;
        row.TRANQTYRECV = stockDetails.tranQtyRecv ?? 0;
        if (!row.STRENGTH1) row.STRENGTH1 = stockDetails.strength;
        if (!row.UNIT) row.UNIT = stockDetails.sku;
        row.UNITCOUNT = stockDetails.unitCount ?? 1;
        row.ITEMTYPENAME = stockDetails.itemTypeName;
        row.EDLTYPE = stockDetails.edlType;
      } catch (err) {
        console.error('Error fetching dynamic stock for saved item:', err);
      }
    }
  }

  return result.rows || [];
}

async function getFacilityStockInHand(facilityId, itemId) {
  const query = `
    SELECT
        SUM(
            CASE
                WHEN b.QASTATUS = '1'
                THEN (NVL(b.ABSRQTY, 0) - NVL(iq.ISSUEQTY, 0))
                ELSE 0
            END
        ) AS STOCK
    FROM TBFACILITYRECEIPTBATCHES b
    INNER JOIN TBFACILITYRECEIPTITEMS i
        ON b.FACRECEIPTITEMID = i.FACRECEIPTITEMID
    INNER JOIN TBFACILITYRECEIPTS t
        ON t.FACRECEIPTID = i.FACRECEIPTID
    INNER JOIN VMASITEMS mi
        ON mi.ITEMID = i.ITEMID
    LEFT JOIN
    (
        SELECT
            fs.FACILITYID,
            fsi.ITEMID,
            ftbo.INWNO,
            SUM(NVL(ftbo.ISSUEQTY, 0)) AS ISSUEQTY
        FROM TBFACILITYISSUES fs
        INNER JOIN TBFACILITYISSUEITEMS fsi
            ON fsi.ISSUEID = fs.ISSUEID
        INNER JOIN TBFACILITYOUTWARDS ftbo
            ON ftbo.ISSUEITEMID = fsi.ISSUEITEMID
        WHERE fs.STATUS = 'C'
        GROUP BY fs.FACILITYID, fsi.ITEMID, ftbo.INWNO
    ) iq
        ON iq.INWNO = b.INWNO
       AND iq.ITEMID = i.ITEMID
       AND iq.FACILITYID = t.FACILITYID
    WHERE t.STATUS = 'C'
      AND (b.WHISSUEBLOCK = 0 OR b.WHISSUEBLOCK IS NULL)
      AND b.EXPDATE > SYSDATE
      AND t.FACILITYID = :facilityId
      AND mi.ITEMID = :itemId
    GROUP BY
        t.FACILITYID,
        mi.ITEMID,
        mi.ITEMCODE,
        mi.ITEMNAME
  `;
  const binds = { facilityId, itemId };
  const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows.length > 0 ? (Number(result.rows[0].STOCK) || 0) : 0;
}

async function getOtherWarehouseStock(facilityId, itemId) {
  const query = `
    SELECT nvl(sum(Ready_QC),0) stk 
    FROM ( 
      SELECT (CASE WHEN sum(A.ReadyForIssue)>0 THEN sum(A.ReadyForIssue) ELSE 0 END) Ready_QC
      FROM 
      (                   
        SELECT w.WAREHOUSENAME, mi.ITEMCODE, b.inwno, mi.ITEMNAME, mi.strength1, mi.unit as SKU, 
               (CASE WHEN b.qastatus ='1' THEN (nvl(b.absrqty,0) - nvl(iq.issueqty,0)) * nvl(mi.unitcount,1)
                     ELSE (CASE WHEN mi.Qctest ='N' THEN (nvl(b.absrqty,0) - nvl(iq.issueqty,0)) * nvl(mi.unitcount,1) 
                     END) 
                END) ReadyForIssue, 
               CASE WHEN mi.qctest='N' THEN 0 
                    ELSE (CASE WHEN b.qastatus = 0 OR b.qastatus = 3 THEN (nvl(b.absrqty,0) - nvl(iq.issueqty,0)) * nvl(mi.unitcount,1) 
                    END) 
                END Pending 
        FROM tbreceiptbatches b  
        INNER JOIN tbreceiptitems i ON b.receiptitemid=i.receiptitemid 
        INNER JOIN tbreceipts t ON t.receiptid=i.receiptid 
        INNER JOIN masitems mi ON mi.itemid=i.itemid 
        INNER JOIN MASWAREHOUSES w ON w.warehouseid=t.warehouseid  
        LEFT OUTER JOIN 
        (  
          SELECT tb.warehouseid, tbi.itemid, tbo.inwno, sum(nvl(tbo.issueqty,0)) issueqty   
          FROM tboutwards tbo, tbindentitems tbi, tbindents tb 
          WHERE tbi.itemid = :itemId
            AND tbo.indentitemid=tbi.indentitemid 
            AND tbi.indentid=tb.indentid 
            AND tb.notindpdmis IS NULL 
            AND tbo.notindpdmis IS NULL 
            AND tbi.notindpdmis IS NULL 
            AND tb.warehouseid NOT IN (SELECT warehouseid FROM masfacilitywh WHERE facilityid=:facilityId)
          GROUP BY tbi.itemid, tb.warehouseid, tbo.inwno  
        ) iq ON b.inwno = iq.inwno 
               AND iq.itemid=i.itemid 
               AND iq.warehouseid=t.warehouseid 
        WHERE T.Status = 'C' 
          AND (b.ExpDate >= SysDate OR nvl(b.ExpDate,SysDate) >= SysDate)  
          AND (b.Whissueblock = 0 OR b.Whissueblock IS NULL) 
          AND mi.itemid = :itemId
          AND t.notindpdmis IS NULL 
          AND b.notindpdmis IS NULL  
          AND i.notindpdmis IS NULL 
          AND w.warehouseid NOT IN (SELECT warehouseid FROM masfacilitywh WHERE facilityid=:facilityId)
      ) A 
      GROUP BY WAREHOUSENAME, A.itemcode, A.ItemName, A.strength1, A.SKU  
      HAVING sum(nvl(A.ReadyForIssue,0)) > 0 OR sum(nvl(A.Pending,0)) > 0
    )
  `;
  const binds = { facilityId, itemId };
  const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows.length > 0 ? (Number(result.rows[0].STK) || 0) : 0;
}

/**
 * Check if previous NOC has items not cancelled or converted to PO.
 * Mirrors CheckNOCancel() from CgmsclNocDHS.aspx.cs
 */
async function checkNocCancel(facilityId) {
  const query = `
    SELECT facilityid, facilityname, nocid, nocnumber, TO_CHAR(nocdate, 'dd-MM-yyyy') AS nocdate,
           COUNT(DISTINCT itemid) AS cntNoitems, COUNT(DISTINCT LPITEMID) AS cntlpitems,
           COUNT(DISTINCT cacelitemid) AS cacelitemid,
           COUNT(DISTINCT itemid) - (COUNT(DISTINCT LPITEMID) + COUNT(DISTINCT cacelitemid)) AS cntbal
    FROM (
      SELECT m.itemcode, mn.nocid, mn.nocnumber, mn.nocdate, f.facilityname, mn.facilityid, mni.itemid,
             lp.LPITEMID, lp.pono, lp.podate, mni.Iscancel,
             CASE WHEN NVL(mni.Iscancel, 'N') = 'Y' THEN mni.itemid END AS cacelitemid
      FROM mascgmscnoc mn
      INNER JOIN mascgmscnocitems mni ON mni.nocid = mn.nocid
      INNER JOIN masfacilities f ON f.facilityid = mn.facilityid
      INNER JOIN masitems m ON m.itemid = mni.itemid
      LEFT OUTER JOIN (
        SELECT lp.PSAID AS Facilityid, lp.ponoid, lp.PONO, lp.PODATE, lpi.LPITEMID, NOCID, m.itemcode
        FROM lpsoorderplaced lp 
        INNER JOIN lpsoordereditems lpi ON lpi.ponoid = lp.ponoid
        INNER JOIN vmasitems mv ON mv.itemid = lpi.LPITEMID
        INNER JOIN masitems m ON m.itemcode = mv.EDLITEMCODE
        WHERE lp.PSAID = :facilityId
          AND lp.ACCYRSETID IN (SELECT accyrsetid FROM masaccyearsettings WHERE SYSDATE BETWEEN startdate AND enddate) 
          AND NOCID IS NOT NULL
      ) lp ON lp.Facilityid = mn.facilityid AND mn.nocid = lp.NOCID AND lp.itemcode = m.itemcode
      WHERE mn.status = 'C' AND NVL(mni.approvedqty, 0) > 0  
        AND mn.accyrsetid IN (SELECT accyrsetid FROM masaccyearsettings WHERE SYSDATE BETWEEN startdate AND enddate) 
        AND mn.facilityid = :facilityId
    ) GROUP BY nocid, nocnumber, nocdate, facilityid, facilityname
    HAVING COUNT(DISTINCT itemid) - (COUNT(DISTINCT LPITEMID) + COUNT(DISTINCT cacelitemid)) > 0
  `;
  try {
    const res = await db.execute(query, { facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.rows && res.rows.length > 0;
  } catch (e) {
    console.error('Error in checkNocCancel:', e);
    return false;
  }
}

/**
 * Check if item is active in annual indent.
 * Mirrors CheckItemIsActive(itemid) from CgmsclNocDHS.aspx.cs
 */
async function checkItemIsActive(facilityId, itemId) {
  const query = `
    SELECT ai.itemid, ROUND(SUM(NVL(ai.cmhodistqty, 0)), 0) AS Indentqty
    FROM anualindent ai
    INNER JOIN masanualindent a ON a.indentid = ai.indentid
    INNER JOIN masitems m ON m.itemid = ai.itemid
    WHERE m.isfreezed IS NULL AND ai.status = 'C' AND a.status = 'C' 
      AND ai.itemid = :itemId
      AND ai.facilityid = :facilityId
      AND ai.accyrsetid IN (SELECT accyrsetid FROM masaccyearsettings WHERE SYSDATE BETWEEN startdate AND enddate)
    GROUP BY ai.itemid, m.unitcount
    HAVING ROUND(SUM(NVL(ai.cmhodistqty, 0)), 0) > 0
  `;
  try {
    const res = await db.execute(query, { itemId, facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.rows && res.rows.length > 0 && Number(res.rows[0].INDENTQTY) > 0;
  } catch (e) {
    console.error('Error in checkItemIsActive:', e);
    return false;
  }
}

/**
 * Check if item already exists in this NOC request.
 * Mirrors IsItemExist(nocid, itemID) from CgmsclNocDHS.aspx.cs
 */
async function isItemExist(nocId, itemId) {
  const query = `SELECT itemid FROM mascgmscnocitems WHERE nocid = :nocId AND itemid = :itemId`;
  const res = await db.execute(query, { nocId, itemId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return res.rows && res.rows.length > 0;
}

/**
 * Save an item into MASCGMSCNOCITEMS.
 * Exactly implements the business rules, validations, and storage from CgmsclNocDHS.aspx.cs (RowUpdating).
 */
async function saveNocItem({
  nocId, facilityId, itemId, requestedqty, stockInHand, itemRemarks,
  isMC = false, urgentNoc = null, urgentRemark = null
}) {
  // 1. Get warehouse ID
  const whQuery = `SELECT warehouseid FROM masfacilitywh WHERE facilityid = :facilityId`;
  const whRes = await db.execute(whQuery, { facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  const whId = whRes.rows.length > 0 ? whRes.rows[0].WAREHOUSEID : '0';

  // 2. Get item unit count
  const itemQuery = `SELECT NVL(unitcount, 1) AS UNITCOUNT FROM masitems WHERE itemid = :itemId`;
  const itemRes = await db.execute(itemQuery, { itemId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  const unitCount = itemRes.rows.length > 0 ? (Number(itemRes.rows[0].UNITCOUNT) || 1) : 1;

  const mAbsQty = Number(requestedqty) || 0;
  if (mAbsQty <= 0) {
    throw new Error("Requested Qty must be greater than 0");
  }
  if (mAbsQty % unitCount !== 0) {
    throw new Error(`Enter Quantity Should be Multiple of ${unitCount}`);
  }

  // 3. Prevent duplicate item in same NOC
  const exists = await isItemExist(nocId, itemId);
  if (exists) {
    throw new Error("This item is already added to this Request. Please edit the existing item below.");
  }

  // 4. Fetch dynamic stock & indent details
  const stock = await getItemStockDetails(facilityId, itemId, isMC);
  const mWHstock = Number(stock.whStock) || 0;
  const mWHstockQC = Number(stock.qcStock) || 0;
  const mOtherWHstk = Number(stock.otherWhStock) || 0;
  const mStockInhand = stockInHand !== undefined && stockInHand !== null ? Number(stockInHand) : (Number(stock.facStock) || 0);
  const mBalIndentqty = Number(stock.balAiQty) || 0;
  const mEstimatedDate = stock.estDate || null;

  const a = mAbsQty;
  const b = mWHstock;

  let mcgmsclRemarks = "";
  let mStatus = "I";
  let mApprovedQty = 0;
  let mBookedQty = 0;
  let mBookedFlag = "null";

  if (!isMC) {
    // Exact DHS Rule from CgmsclNocDHS.aspx.cs line 465:
    if (mWHstock === 0 || a > b) {
      throw new Error("Automatic NOC Process has been blocked, You may Contact/Letter to Central Store DHS with the Requirement.");
    }

    // Complete stock available in WH (Convert.ToInt32(mWHstock) > 0 && Convert.ToInt32(mWHstock) >= a):
    mcgmsclRemarks = "Indent Placed";
    mStatus = "N";
    mApprovedQty = 0;
    mBookedQty = mAbsQty;
    mBookedFlag = "B";
  } else {
    // MC logic
    if (mWHstock >= mAbsQty) {
      mBookedQty = mAbsQty;
      mcgmsclRemarks = "Fully Booked";
    } else {
      mBookedQty = mWHstock;
      mApprovedQty = mAbsQty - mWHstock;
      mcgmsclRemarks = "Noc Pending For Approval";
    }
  }

  // Convert quantities to PACKS for storage in MASCGMSCNOCITEMS
  const aqty = Math.floor(mAbsQty / unitCount);
  const whstockPacks = Math.floor(mWHstock / unitCount);
  const qcqty = Math.floor(mWHstockQC / unitCount);
  const bqty = Math.floor(mBookedQty / unitCount);
  const appqty = Math.floor(mApprovedQty / unitCount);

  if (appqty > 0) {
    const hasCancel = await checkNocCancel(facilityId);
    if (hasCancel) {
      throw new Error("NOC can't be Generated.(Suggestion :Please Cancel Previous NOC Or Generate Local PO On Previous NOC.)");
    }
    const isActive = await checkItemIsActive(facilityId, itemId);
    if (!isActive) {
      throw new Error("This Drug is not in Your Annual Indent then NOC can not be Generated");
    }
  }

  let safeEstDateObj = null;
  if (mEstimatedDate && mEstimatedDate !== 'null' && mEstimatedDate !== '0') {
    const parts = String(mEstimatedDate).split(/[-/]/);
    if (parts.length === 3 && parts[2].length === 4) {
      safeEstDateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    } else {
      safeEstDateObj = new Date(mEstimatedDate);
    }
    if (isNaN(safeEstDateObj)) safeEstDateObj = null;
  }

  const query = `
    INSERT INTO MASCGMSCNOCITEMS
      (NOCID, ITEMID, REQUESTEDQTY, WHSTOCK, ITEMREMARKS, 
       WHSTOCKQCPENDING, ESTIMATEDDATE, WHID, CGMSCLREMARKS, 
       OTHERWHSTOCK, STATUS, APPROVEDQTY, BOOKEDQTY, BOOKEDFLAG, STOCKINHAND,
       ENTRY_DATE)
    VALUES
      (:nocId, :itemId, :requestedqty, :whStock, :itemRemarks, 
       :whStockQcPending, :estimatedDate, :whId, :cgmsclRemarks, 
       :otherWhStock, :status, :approvedQty, :bookedQty, :bookedFlag, :stockInHand,
       SYSDATE)
    RETURNING SR INTO :nocItemId
  `;

  const binds = {
    nocId,
    itemId,
    requestedqty: aqty,
    whStock: whstockPacks,
    itemRemarks: itemRemarks || null,
    whStockQcPending: qcqty,
    estimatedDate: safeEstDateObj,
    whId: whId || 0,
    cgmsclRemarks: mcgmsclRemarks || null,
    otherWhStock: mOtherWHstk || 0,
    status: mStatus,
    approvedQty: appqty,
    bookedQty: bqty,
    bookedFlag: mBookedFlag === 'null' ? null : mBookedFlag,
    stockInHand: mStockInhand,
    nocItemId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
  };

  const result = await db.execute(query, binds, { autoCommit: true });
  return result.outBinds.nocItemId[0];
}

/**
 * Update an existing NOC item row.
 * Mirrors RowUpdating edit mode in CgmsclNocDHS.aspx.cs.
 */
async function updateNocItem({ nocItemId, requestedqty, stockInHand, itemRemarks }) {
  const fetchQuery = `
    SELECT b.NOCID, b.ITEMID, b.WHSTOCK, b.WHSTOCKQCPENDING, b.OTHERWHSTOCK, b.STATUS, mi.UNITCOUNT
    FROM MASCGMSCNOCITEMS b
    INNER JOIN MASITEMS mi ON mi.ITEMID = b.ITEMID
    WHERE b.SR = :nocItemId
  `;
  const res = await db.execute(fetchQuery, { nocItemId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  if (!res.rows || res.rows.length === 0) throw new Error("Item not found");

  const row = res.rows[0];
  const unitCount = Number(row.UNITCOUNT) || 1;
  const mAbsQty = Number(requestedqty) || 0;
  if (mAbsQty <= 0) throw new Error("Requested Qty must be greater than 0");
  if (mAbsQty % unitCount !== 0) throw new Error(`Enter Quantity Should be Multiple of ${unitCount}`);

  // WHSTOCK in DB is in packs, convert to Nos:
  const mWHstock = (Number(row.WHSTOCK) || 0) * unitCount;
  const a = mAbsQty;
  const b = mWHstock;

  if (mWHstock === 0 || a > b) {
    throw new Error("Automatic NOC Process has been blocked, You may Contact/Letter to Central Store DHS with the Requirement.");
  }

  const aqty = Math.floor(mAbsQty / unitCount);
  const whstockPacks = Number(row.WHSTOCK) || 0;
  const qcqty = Number(row.WHSTOCKQCPENDING) || 0;
  const bqty = aqty;
  const appqty = 0;
  const mStockInhand = stockInHand !== undefined ? Number(stockInHand) : 0;

  const query = `
    UPDATE MASCGMSCNOCITEMS SET
      REQUESTEDQTY  = :aqty,
      WHSTOCK       = :whstockPacks,
      ITEMREMARKS   = :itemRemarks,
      WHSTOCKQCPENDING = :qcqty,
      BOOKEDQTY     = :bqty,
      APPROVEDQTY   = :appqty,
      STOCKINHAND   = :stockInHand
    WHERE SR = :nocItemId
  `;
  await db.execute(
    query,
    { 
      nocItemId, 
      aqty, 
      whstockPacks,
      itemRemarks: itemRemarks === 'null' ? null : (itemRemarks || null),
      qcqty,
      bqty, 
      appqty, 
      stockInHand: mStockInhand
    },
    { autoCommit: true }
  );
}

/**
 * Delete a single NOC item.
 */
async function deleteNocItem(nocItemId) {
  await db.execute(
    `DELETE FROM MASCGMSCNOCITEMS WHERE SR = :nocItemId`,
    { nocItemId },
    { autoCommit: true }
  );
}

/**
 * Fetch FM-items based on facility rules.
 */
async function getFmItemsForFacility(facilityId, itemType, categoryId = 1) {
  const query = `
    SELECT l.itemid, l.ITEMCODE, l.ITEMNAME, l.STRENGTH1, l.UNIT, l.UNITCOUNT, l.edl,
           READYQTY*nvl(UNITCOUNT,1) as ReadyStockWHNos,
           UQQTY*nvl(UNITCOUNT,1) as UQCStockWHNos,
           IWHPIPQTY*nvl(UNITCOUNT,1) as IWHPiplineStockNos,
           CGMSCFM, GROUPNAME, ITEMTYPENAME, e.edlcat, l.RECEIPTDATEWH, l.QCPASSEDDT,
           nvl(facstock.itemstock,0) as FACILITYSTOCK,
           nvl(bal.BalanceAIQTYNOS, 0) as BALANCEAIQTYNOS
    FROM V_WH_CURRENTSTOCK_STOCKSTATUS_Live l
    LEFT OUTER JOIN masedl e ON e.edl = l.edl
    LEFT OUTER JOIN
    (
        select itemid, sum(batchstock) as itemstock
        from
        (
            select b.batchno,
                   (case
                        when b.qastatus='1'
                        then (nvl(b.absrqty,0)-nvl(iq.issueqty,0))
                    end) BatchStock,
                   b.inwno,
                   case
                        when mi.EDLITEMCODE is not null
                        then edlitemcode
                        else mi.itemcode
                   end as ITEMCODE,
                   case
                        when mi.EDLITEMCODE is not null
                        then mvm.itemid
                        else 0
                   end as itemid
            from tbfacilityreceiptbatches b
            inner join tbfacilityreceiptitems i
                on b.facreceiptitemid=i.facreceiptitemid
            inner join tbfacilityreceipts t
                on t.facreceiptid=i.facreceiptid
            inner join vmasitems mi
                on mi.itemid=i.itemid
            inner join masfacilities f
                on f.facilityid=t.facilityid
               and f.facilityid=:facilityId
            inner join mv_masitems mvm
                on mvm.itemcode=mi.EDLITEMCODE
            left outer join
            (
                select fs.facilityid,
                       fsi.itemid,
                       ftbo.inwno,
                       sum(nvl(ftbo.issueqty,0)) issueqty
                from tbfacilityissues fs
                inner join tbfacilityissueitems fsi
                    on fsi.issueid=fs.issueid
                inner join tbfacilityoutwards ftbo
                    on ftbo.issueitemid=fsi.issueitemid
                where fs.status='C'
                  and fs.facilityid=:facilityId
                group by fsi.itemid,
                         fs.facilityid,
                         ftbo.inwno
            ) iq
                on b.inwno=iq.inwno
               and iq.itemid=i.itemid
               and iq.facilityid=t.facilityid

            where T.Status='C'
              and (b.Whissueblock=0 or b.Whissueblock is null)
              and b.expdate>sysdate
              and f.facilityid=:facilityId
              and (
                    case
                        when b.qastatus='1'
                        then (nvl(b.absrqty,0)-nvl(iq.issueqty,0))
                    end
                  ) > 0
        )
        group by itemid
    ) facstock
        on facstock.itemid=l.itemid
    left outer join
    (
        select a.itemid,
               case when (sum(nvl(a.CMHODISTQTY,0)) - nvl(iss.IssuedQTYNos,0)) > 0 
                    then (sum(nvl(a.CMHODISTQTY,0)) - nvl(iss.IssuedQTYNos,0)) 
                    else 0 end as BalanceAIQTYNOS
        from anualindent a 
        inner join masaccyearsettings yr on yr.accyrsetid = a.accyrsetid
        left outer join (
            select tbi.itemid, sum((tbo.issueqty + nvl(tbo.reconcile_qty,0)) * nvl(m.unitcount,1)) as IssuedQTYNos
            from tbindents tb
            inner join tbindentitems tbi on tbi.indentid = tb.indentid
            inner join masitems m on m.itemid = tbi.itemid
            inner join tboutwards tbo on tbo.indentitemid = tbi.indentitemid
            inner join masaccyearsettings ay on tb.INDENTDATE between ay.startdate and ay.enddate
            where tb.issuetype = 'NO' and sysdate between ay.startdate and ay.enddate
              and tb.status = 'C' and tb.facilityid = :facilityId
            group by tbi.itemid
        ) iss on iss.itemid = a.itemid
        where a.status = 'C' and a.facilityid = :facilityId
          and sysdate between yr.startdate and yr.enddate
        group by a.itemid, iss.IssuedQTYNos
    ) bal on bal.itemid = l.itemid
    WHERE (l.MCID = :categoryId OR :categoryId IS NULL OR :categoryId = 0 OR :categoryId = '0') 
      AND WAREHOUSEID IN (SELECT WAREHOUSEID FROM MASFACILITYWH WHERE FACILITYID = :facilityId)
      AND CGMSCFM = :itemType
      AND (nvl(READYQTY,0) + nvl(UQQTY,0) + nvl(IWHPIPQTY,0)) > 0
      AND e.edlcat <= (SELECT eldcat FROM masfacilityTypes ty 
                       INNER JOIN masfacilities f ON f.facilitytypeid = ty.facilitytypeid 
                       WHERE f.facilityid = :facilityId)
    ORDER BY GROUPNAME, ITEMNAME
  `;
  const binds = { facilityId, itemType, categoryId };
  const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows;
}

/**
 * Get Available or Stock Out items from the warehouse for the facility.
 * itemType should be 'AVAILABLE', 'STOCKOUT', or 'STOCK_AND_AVAILABLE'.
 */
async function getWarehouseItemsForFacility(facilityId, itemType, categoryId = 1) {
  // Determine condition string based on itemType
  let qtyCondition = '1=1'; // default for STOCK_AND_AVAILABLE
  if (itemType === 'AVAILABLE') {
    qtyCondition = '(nvl(READYQTY,0)+nvl(UQQTY,0)+nvl(IWHPIPQTY,0)+nvl(PIPELINEQTY,0)) > 0';
  } else if (itemType === 'STOCKOUT') {
    qtyCondition = '(nvl(READYQTY,0)+nvl(UQQTY,0)+nvl(IWHPIPQTY,0)+nvl(PIPELINEQTY,0)) <= 0';
  }

  const query = `
select WAREHOUSENAME,WAREHOUSEID,MCATEGORY,MCID,EDLTYPE,PROGRAM,PROGRAMITEMS,AISTATUS,
       ITEMNAME,ITEMCODE,STRENGTH1,UNIT,l.ITEMID,UNITCOUNT,l.edl,l.RECEIPTDATEWH,l.QCPASSEDDT,
       READYQTY*nvl(UNITCOUNT,1) as ReadyStockWHNos,
       NEAREXPQTY3MONTH*nvl(UNITCOUNT,1) as NEAREXPQTY3MONTH,
       UQQTY*nvl(UNITCOUNT,1) as UQCStockWHNos,
       IWHPIPQTY*nvl(UNITCOUNT,1) as IWHPiplineStockNos,
       PIPELINEQTY*nvl(UNITCOUNT,1) as PIPELINEQTY,
       RECEIPTDATEATWAREHOUSE,
       CGMSCFM,
       GROUPNAME,
       ITEMTYPENAME,
       ABCCATEGORY,
       VEDCATEGORY,
       nvl(facstock.itemstock,0) as FACILITYSTOCK,
       nvl(bal.BalanceAIQTYNOS, 0) as BALANCEAIQTYNOS
from V_WH_CURRENTSTOCK_STOCKSTATUS_Live l
left outer join masedl e
    on e.edl=l.edl

left outer join
(
    select itemid, sum(batchstock) as itemstock
    from
    (
        select b.batchno,
               (case
                    when b.qastatus='1'
                    then (nvl(b.absrqty,0)-nvl(iq.issueqty,0))
                end) BatchStock,
               b.inwno,
               case
                    when mi.EDLITEMCODE is not null
                    then edlitemcode
                    else mi.itemcode
               end as ITEMCODE,
               case
                    when mi.EDLITEMCODE is not null
                    then mvm.itemid
                    else 0
               end as itemid
        from tbfacilityreceiptbatches b
        inner join tbfacilityreceiptitems i
            on b.facreceiptitemid=i.facreceiptitemid
        inner join tbfacilityreceipts t
            on t.facreceiptid=i.facreceiptid
        inner join vmasitems mi
            on mi.itemid=i.itemid
        inner join masfacilities f
            on f.facilityid=t.facilityid
           and f.facilityid=:facilityId
        inner join mv_masitems mvm
            on mvm.itemcode=mi.EDLITEMCODE
        left outer join
        (
            select fs.facilityid,
                   fsi.itemid,
                   ftbo.inwno,
                   sum(nvl(ftbo.issueqty,0)) issueqty
            from tbfacilityissues fs
            inner join tbfacilityissueitems fsi
                on fsi.issueid=fs.issueid
            inner join tbfacilityoutwards ftbo
                on ftbo.issueitemid=fsi.issueitemid
            where fs.status='C'
              and fs.facilityid=:facilityId
            group by fsi.itemid,
                     fs.facilityid,
                     ftbo.inwno
        ) iq
            on b.inwno=iq.inwno
           and iq.itemid=i.itemid
           and iq.facilityid=t.facilityid

        where T.Status='C'
          and (b.Whissueblock=0 or b.Whissueblock is null)
          and b.expdate>sysdate
          and f.facilityid=:facilityId
          and (
                case
                    when b.qastatus='1'
                    then (nvl(b.absrqty,0)-nvl(iq.issueqty,0))
                end
              ) > 0
    )
    group by itemid
) facstock
    on facstock.itemid=l.itemid
left outer join
(
    select a.itemid,
           case when (sum(nvl(a.CMHODISTQTY,0)) - nvl(iss.IssuedQTYNos,0)) > 0 
                then (sum(nvl(a.CMHODISTQTY,0)) - nvl(iss.IssuedQTYNos,0)) 
                else 0 end as BalanceAIQTYNOS
    from anualindent a 
    inner join masaccyearsettings yr on yr.accyrsetid = a.accyrsetid
    left outer join (
        select tbi.itemid, sum((tbo.issueqty + nvl(tbo.reconcile_qty,0)) * nvl(m.unitcount,1)) as IssuedQTYNos
        from tbindents tb
        inner join tbindentitems tbi on tbi.indentid = tb.indentid
        inner join masitems m on m.itemid = tbi.itemid
        inner join tboutwards tbo on tbo.indentitemid = tbi.indentitemid
        inner join masaccyearsettings ay on tb.INDENTDATE between ay.startdate and ay.enddate
        where tb.issuetype = 'NO' and sysdate between ay.startdate and ay.enddate
          and tb.status = 'C' and tb.facilityid = :facilityId
        group by tbi.itemid
    ) iss on iss.itemid = a.itemid
    where a.status = 'C' and a.facilityid = :facilityId
      and sysdate between yr.startdate and yr.enddate
    group by a.itemid, iss.IssuedQTYNos
) bal on bal.itemid = l.itemid

where (l.MCID = :categoryId OR :categoryId IS NULL OR :categoryId = 0 OR :categoryId = '0')

and WAREHOUSEID in
(
    select mappedwh from masfacilities where facilityid=:facilityId
)
and ${qtyCondition}
and e.edlcat <= (select eldcat from masfacilityTypes ty 
                 inner join masfacilities f on f.facilitytypeid=ty.facilitytypeid 
                 where f.facilityid=:facilityId)
order by GROUPNAME, ITEMNAME
  `;
  const binds = { facilityId, categoryId };
  const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows;
}

/**
 * Get DHS Indent items from the warehouse for the facility.
 */
async function getDhsIndentItemsForFacility(facilityId, categoryId = 1) {
  const query = `
select
    WAREHOUSENAME,
    WAREHOUSEID,
    MCATEGORY,
    l.DIRECTORATEAI,
    MCID,
    EDLTYPE,
    PROGRAM,
    PROGRAMITEMS,
    AISTATUS,
    ITEMNAME,
    ITEMCODE,
    STRENGTH1,
    UNIT,
    l.ITEMID,
    UNITCOUNT,
    l.edl,
    l.RECEIPTDATEWH,
    l.QCPASSEDDT,
    READYQTY * nvl(UNITCOUNT,1) as ReadyStockWHNos,
    NEAREXPQTY3MONTH * nvl(UNITCOUNT,1) as NEAREXPQTY3MONTH,
    UQQTY * nvl(UNITCOUNT,1) as UQCStockWHNos,
    IWHPIPQTY * nvl(UNITCOUNT,1) as IWHPiplineStockNos,
    PIPELINEQTY * nvl(UNITCOUNT,1) as PIPELINEQTY,
    RECEIPTDATEATWAREHOUSE,
    CGMSCFM,
    GROUPNAME,
    ITEMTYPENAME,
    ABCCATEGORY,
    VEDCATEGORY,
    nvl(facstock.itemstock,0) as FACILITYSTOCK,
    nvl(bal.BalanceAIQTYNOS, 0) as BALANCEAIQTYNOS
from V_WH_CURRENTSTOCK_STOCKSTATUS_Live l

left outer join masedl e
    on e.edl = l.edl

left outer join
(
    select
        itemid,
        sum(batchstock) as itemstock
    from
    (
        select
            b.batchno,
            (case
                when b.qastatus = '1'
                then (nvl(b.absrqty,0) - nvl(iq.issueqty,0))
             end) BatchStock,
            b.inwno,
            case
                when mi.EDLITEMCODE is not null
                then edlitemcode
                else mi.itemcode
            end as ITEMCODE,
            case
                when mi.EDLITEMCODE is not null
                then mvm.itemid
                else 0
            end as itemid
        from tbfacilityreceiptbatches b

        inner join tbfacilityreceiptitems i
            on b.facreceiptitemid = i.facreceiptitemid

        inner join tbfacilityreceipts t
            on t.facreceiptid = i.facreceiptid

        inner join vmasitems mi
            on mi.itemid = i.itemid

        inner join masfacilities f
            on f.facilityid = t.facilityid
           and f.facilityid = :facilityId

        inner join mv_masitems mvm
            on mvm.itemcode = mi.EDLITEMCODE

        left outer join
        (
            select
                fs.facilityid,
                fsi.itemid,
                ftbo.inwno,
                sum(nvl(ftbo.issueqty,0)) issueqty
            from tbfacilityissues fs

            inner join tbfacilityissueitems fsi
                on fsi.issueid = fs.issueid

            inner join tbfacilityoutwards ftbo
                on ftbo.issueitemid = fsi.issueitemid

            where fs.status = 'C'
              and fs.facilityid = :facilityId

            group by
                fsi.itemid,
                fs.facilityid,
                ftbo.inwno

        ) iq
            on b.inwno = iq.inwno
           and iq.itemid = i.itemid
           and iq.facilityid = t.facilityid

        where T.Status = 'C'
          and (b.Whissueblock = 0 or b.Whissueblock is null)
          and b.expdate > sysdate
          and f.facilityid = :facilityId
          and (
                case
                    when b.qastatus = '1'
                    then (nvl(b.absrqty,0) - nvl(iq.issueqty,0))
                end
              ) > 0
    )
    group by itemid

) facstock
    on facstock.itemid = l.itemid

left outer join
(
    select a.itemid,
           case when (sum(nvl(a.CMHODISTQTY,0)) - nvl(iss.IssuedQTYNos,0)) > 0 
                then (sum(nvl(a.CMHODISTQTY,0)) - nvl(iss.IssuedQTYNos,0)) 
                else 0 end as BalanceAIQTYNOS
    from anualindent a 
    inner join masaccyearsettings yr on yr.accyrsetid = a.accyrsetid
    left outer join (
        select tbi.itemid, sum((tbo.issueqty + nvl(tbo.reconcile_qty,0)) * nvl(m.unitcount,1)) as IssuedQTYNos
        from tbindents tb
        inner join tbindentitems tbi on tbi.indentid = tb.indentid
        inner join masitems m on m.itemid = tbi.itemid
        inner join tboutwards tbo on tbo.indentitemid = tbi.indentitemid
        inner join masaccyearsettings ay on tb.INDENTDATE between ay.startdate and ay.enddate
        where tb.issuetype = 'NO' and sysdate between ay.startdate and ay.enddate
          and tb.status = 'C' and tb.facilityid = :facilityId
        group by tbi.itemid
    ) iss on iss.itemid = a.itemid
    where a.status = 'C' and a.facilityid = :facilityId
      and sysdate between yr.startdate and yr.enddate
    group by a.itemid, iss.IssuedQTYNos
) bal on bal.itemid = l.itemid

where (l.MCID = :categoryId OR :categoryId IS NULL OR :categoryId = 0 OR :categoryId = '0')
  and WAREHOUSEID in
(
    select warehouseid
    from MASFACILITYWH
    where facilityid = :facilityId
)
  and (nvl(READYQTY,0)
     + nvl(UQQTY,0)
     + nvl(IWHPIPQTY,0)
     + nvl(PIPELINEQTY,0)) > 0
  and l.DIRECTORATEAI = 'DHS Annul Indent'
  and e.edlcat <=
  (
      select eldcat
      from masfacilityTypes ty
      inner join masfacilities f
          on f.facilitytypeid = ty.facilitytypeid
         and f.facilityid = :facilityId
  )

order by
    GROUPNAME,
    ITEMNAME
  `;
  const binds = { facilityId, categoryId };
  const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows;
}

/**
 * Fetch a specific item details for 'OTHER' item type.
 */
async function getOtherItemForFacility(facilityId, itemCode) {
  const query = `
    select 
        WAREHOUSENAME,
        WAREHOUSEID,
        MCATEGORY,
        MCID,
        EDLTYPE,
        PROGRAM,
        PROGRAMITEMS,
        AISTATUS,
        ITEMNAME,
        ITEMCODE,
        STRENGTH1,
        UNIT,
        l.ITEMID,
        UNITCOUNT,
        l.edl,
        l.RECEIPTDATEWH,
        l.QCPASSEDDT,
        READYQTY * nvl(UNITCOUNT,1) as READYSTOCKWHNOS,
        NEAREXPQTY3MONTH * nvl(UNITCOUNT,1) as NEAREXPQTY3MONTH,
        UQQTY * nvl(UNITCOUNT,1) as UQCSTOCKWHNOS,
        IWHPIPQTY * nvl(UNITCOUNT,1) as IWHPIPLINESTOCKNOS,
        PIPELINEQTY * nvl(UNITCOUNT,1) as PIPELINEQTY,
        RECEIPTDATEATWAREHOUSE,
        CGMSCFM,
        GROUPNAME,
        ITEMTYPENAME,
        ABCCATEGORY,
        VEDCATEGORY,
        nvl(facstock.itemstock,0) as FACILITYSTOCK,
        nvl(bal.BalanceAIQTYNOS, 0) as BALANCEAIQTYNOS
    from V_WH_CURRENTSTOCK_STOCKSTATUS_Live l
    left outer join masedl e
        on e.edl = l.edl
    left outer join
    (
        select itemid, sum(batchstock) as itemstock
        from
        (
            select
                b.batchno,
                case
                    when b.qastatus = '1'
                    then (nvl(b.absrqty,0) - nvl(iq.issueqty,0))
                end as BatchStock,
                b.inwno,
                case
                    when mi.EDLITEMCODE is not null
                    then edlitemcode
                    else mi.itemcode
                end as ITEMCODE,
                case
                    when mi.EDLITEMCODE is not null
                    then mvm.itemid
                    else 0
                end as itemid
            from tbfacilityreceiptbatches b
            inner join tbfacilityreceiptitems i
                on b.facreceiptitemid = i.facreceiptitemid
            inner join tbfacilityreceipts t
                on t.facreceiptid = i.facreceiptid
            inner join vmasitems mi
                on mi.itemid = i.itemid
            inner join masfacilities f
                on f.facilityid = t.facilityid
               and f.facilityid = :facilityId
            inner join mv_masitems mvm
                on mvm.itemcode = mi.EDLITEMCODE
            left outer join
            (
                select
                    fs.facilityid,
                    fsi.itemid,
                    ftbo.inwno,
                    sum(nvl(ftbo.issueqty,0)) as issueqty
                from tbfacilityissues fs
                inner join tbfacilityissueitems fsi
                    on fsi.issueid = fs.issueid
                inner join tbfacilityoutwards ftbo
                    on ftbo.issueitemid = fsi.issueitemid
                where fs.status = 'C'
                  and fs.facilityid = :facilityId
                group by
                    fs.facilityid,
                    fsi.itemid,
                    ftbo.inwno
            ) iq
                on iq.inwno = b.inwno
               and iq.itemid = i.itemid
               and iq.facilityid = t.facilityid
            where t.status = 'C'
              and (b.whissueblock = 0 or b.whissueblock is null)
              and b.expdate > sysdate
              and f.facilityid = :facilityId
              and (
                    case
                        when b.qastatus = '1'
                        then (nvl(b.absrqty,0) - nvl(iq.issueqty,0))
                    end
                  ) > 0
        )
        group by itemid
    ) facstock
        on facstock.itemid = l.itemid
    left outer join
    (
        select a.itemid,
               case when (sum(nvl(a.CMHODISTQTY,0)) - nvl(iss.IssuedQTYNos,0)) > 0 
                    then (sum(nvl(a.CMHODISTQTY,0)) - nvl(iss.IssuedQTYNos,0)) 
                    else 0 end as BalanceAIQTYNOS
        from anualindent a 
        inner join masaccyearsettings yr on yr.accyrsetid = a.accyrsetid
        left outer join (
            select tbi.itemid, sum((tbo.issueqty + nvl(tbo.reconcile_qty,0)) * nvl(m.unitcount,1)) as IssuedQTYNos
            from tbindents tb
            inner join tbindentitems tbi on tbi.indentid = tb.indentid
            inner join masitems m on m.itemid = tbi.itemid
            inner join tboutwards tbo on tbo.indentitemid = tbi.indentitemid
            inner join masaccyearsettings ay on tb.INDENTDATE between ay.startdate and ay.enddate
            where tb.issuetype = 'NO' and sysdate between ay.startdate and ay.enddate
              and tb.status = 'C' and tb.facilityid = :facilityId
            group by tbi.itemid
        ) iss on iss.itemid = a.itemid
        where a.status = 'C' and a.facilityid = :facilityId
          and sysdate between yr.startdate and yr.enddate
        group by a.itemid, iss.IssuedQTYNos
    ) bal on bal.itemid = l.itemid
    where l.warehouseid in (select warehouseid from masfacilitywh where facilityid = :facilityId)
      and l.itemcode = :itemCode
      and (nvl(READYQTY,0) + nvl(UQQTY,0) + nvl(IWHPIPQTY,0)) > 0
      and e.edlcat <=
      (
          select eldcat
          from masfacilitytypes ty
          inner join masfacilities f
              on f.facilitytypeid = ty.facilitytypeid
             and f.facilityid = :facilityId
      )
  `;
  const binds = { facilityId, itemCode };
  const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows;
}

async function getAgainstApprovalIndentItemsForFacility(facilityId, categoryId = 1) {
  const query = `
select NOCPermission,a.itemid,facilityname,facAI_Nos,AIDist_Nos
,nvl(itemstock,0) as FACStock
,nvl(IssuedQTYNos,0) as WHIssuedCFY, case when (AIDist_Nos-nvl(IssuedQTYNos,0))>0 then AIDist_Nos-nvl(IssuedQTYNos,0) else 0 end as BalanceAIQTYNOS
,ReadyWHSKU,ReadyWHNos,UQCNOS,UQCSKU,RECEIPTDATEATWAREHOUSE,QCPASSEDDATE,
FACILITYID,hodid,accyrsetid,facilitytypeid,Statusyear,m.unitcount,a.WAREHOUSEID,
    m.ITEMNAME,
    m.ITEMCODE,
    m.STRENGTH,
    m.UNIT,m.MCATEGORY,ITEMTYPENAME,GROUPNAME
from 
(

select a.itemid,sum(FACILITYINDENTQTY) facAI_Nos,sum(nvl(CMHODISTQTY,0)) AIDist_Nos,a.FACILITYID
    ,a.accyrsetid,hodid,t.facilitytypeid,f.facilityname
    ,case when sysdate between yr.startdate and yr.enddate then 'Y' else 'N' end as Statusyear
    ,nvl(t.NOCApplyPermission,'N') as NOCPermission,wf.WAREHOUSEID
            from anualindent a 
            inner join masfacilities f  on f.facilityid=a.facilityid     
            inner join masfacilitywh wf on wf.facilityid=f.facilityid
             inner join masfacilitytypes t on t.facilitytypeid=f.facilitytypeid
             inner join masaccyearsettings yr on yr.accyrsetid=a.accyrsetid
            where a.status = 'C' and f.isactive=1  and f.facilityid=:facilityId
            and (case when sysdate between yr.startdate and yr.enddate then 'Y' else 'N' end)='Y'     
            group by t.NOCApplyPermission,a.itemid,a.accyrsetid,hodid,t.facilitytypeid,f.facilityname,a.FACILITYID
           , yr.startdate,yr.enddate,wf.WAREHOUSEID
         having sum(nvl(CMHODISTQTY,0))>0  
         )a
         
         left outer join 
         (
         select  itemid ,warehouseid, READYQTY * nvl(UNITCOUNT,1) as ReadyWHNos,READYQTY as ReadyWHSKU,
    NEAREXPQTY3MONTH * nvl(UNITCOUNT,1) as NEAREXPQTY3MONTH,NEAREXPQTY3MONTH as NEAREXPQTY3MONTHSKU,
    UQQTY * nvl(UNITCOUNT,1) as UQCNOS,UQQTY as UQCSKU,QCPASSEDDATE,RECEIPTDATEATWAREHOUSE from V_WH_CURRENTSTOCK_STOCKSTATUS_Live l   
         ) whst on whst.itemid=a.itemid and whst.WAREHOUSEID=a.WAREHOUSEID
         
         left outer join
(
    select
        itemid,
        sum(batchstock) as itemstock
    from
    (
        select
            b.batchno,
            (case
                when b.qastatus = '1'
                then (nvl(b.absrqty,0) - nvl(iq.issueqty,0))
             end) BatchStock,
            b.inwno,
            case
                when mi.EDLITEMCODE is not null
                then edlitemcode
                else mi.itemcode
            end as ITEMCODE,
            case
                when mi.EDLITEMCODE is not null
                then mvm.itemid
                else 0
            end as itemid
        from tbfacilityreceiptbatches b

        inner join tbfacilityreceiptitems i
            on b.facreceiptitemid = i.facreceiptitemid

        inner join tbfacilityreceipts t
            on t.facreceiptid = i.facreceiptid

        inner join vmasitems mi
            on mi.itemid = i.itemid

        inner join masfacilities f
            on f.facilityid = t.facilityid
           and f.facilityid = :facilityId

        inner join mv_masitems mvm
            on mvm.itemcode = mi.EDLITEMCODE

        left outer join
        (
            select
                fs.facilityid,
                fsi.itemid,
                ftbo.inwno,
                sum(nvl(ftbo.issueqty,0)) issueqty
            from tbfacilityissues fs

            inner join tbfacilityissueitems fsi
                on fsi.issueid = fs.issueid

            inner join tbfacilityoutwards ftbo
                on ftbo.issueitemid = fsi.issueitemid

            where fs.status = 'C'
              and fs.facilityid = :facilityId
     

            group by
                fsi.itemid,
                fs.facilityid,
                ftbo.inwno

        ) iq
            on b.inwno = iq.inwno
           and iq.itemid = i.itemid
           and iq.facilityid = t.facilityid

        where T.Status = 'C'
          and (b.Whissueblock = 0 or b.Whissueblock is null)
          and b.expdate > sysdate
          and f.facilityid = :facilityId
          and (
                case
                    when b.qastatus = '1'
                    then (nvl(b.absrqty,0) - nvl(iq.issueqty,0))
                end
              ) > 0
    )
    group by itemid

) facstock
    on facstock.itemid = a.itemid
    
    
    left outer join 
    (
    select itemid,sum(iss_qty)iss_qty,sum(IssuedQTYNos) as IssuedQTYNos 
from 
(

SELECT
    tb.facilityid,
    tbi.itemid,
    (tbo.issueqty + NVL(tbo.reconcile_qty,0)) AS iss_qty,
    (tbo.issueqty + NVL(tbo.reconcile_qty,0))*nvl(m.unitcount,1) AS IssuedQTYNos,

    ay.ACCYRSETID
FROM tbindents tb
INNER JOIN masfacilities f
    ON f.facilityid = tb.facilityid
INNER JOIN masfacilitytypes t
    ON t.facilitytypeid = f.facilitytypeid
INNER JOIN tbindentitems tbi
    ON tbi.indentid = tb.indentid
    inner join masitems m on m.itemid=tbi.itemid
INNER JOIN tboutwards tbo
    ON tbo.indentitemid = tbi.indentitemid
INNER JOIN tbreceiptbatches rb
    ON rb.inwno = tbo.inwno
INNER JOIN masaccyearsettings ay
    ON tb.INDENTDATE BETWEEN ay.startdate AND ay.enddate
WHERE tb.issuetype = 'NO' and sysdate between ay.startdate and ay.enddate
  AND tb.status = 'C' and f.facilityid=:facilityId
  ) group by facilityid,itemid
    ) iss on iss.itemid=a.itemid
    
    inner join mv_masitems m on m.itemid=a.itemid
    where (m.MCID = :categoryId OR :categoryId IS NULL OR :categoryId = 0 OR :categoryId = '0')
  `;
  const binds = { facilityId, categoryId };
  const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows;
}

async function getItemStockDetails(facilityId, itemId, isMC = false) {
  // 1. Get warehouse ID for facility
  const whQuery = `SELECT warehouseid FROM masfacilitywh WHERE facilityid = :facilityId`;
  const whRes = await db.execute(whQuery, { facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  const whId = whRes.rows.length > 0 ? whRes.rows[0].WAREHOUSEID : '0';

  // 2. Get Unit Count and Item Details safely
  let unitCount = 1, strength = '', sku = '', edlType = '', itemTypeName = '';
  
  try {
    const unitQuery = `SELECT NVL(UNITCOUNT, 1) as UNITCOUNT, STRENGTH1, UNIT FROM masitems WHERE itemid = :itemId`;
    const unitRes = await db.execute(unitQuery, { itemId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (unitRes.rows.length > 0) {
      unitCount = unitRes.rows[0].UNITCOUNT || 1;
      strength = unitRes.rows[0].STRENGTH1;
      sku = unitRes.rows[0].UNIT;
    }
  } catch (e) {
    console.error('Error fetching unit details:', e);
  }

  try {
    const typeQuery = `SELECT t.ITEMTYPENAME FROM MASITEMS m JOIN MASITEMTYPES t ON t.ITEMTYPEID = m.ITEMTYPEID WHERE m.itemid = :itemId`;
    const typeRes = await db.execute(typeQuery, { itemId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (typeRes.rows.length > 0) {
      itemTypeName = typeRes.rows[0].ITEMTYPENAME;
    }
  } catch (e) {
    console.error('Error fetching type details:', e);
  }

  try {
    const edlQuery = `SELECT EDL FROM MASITEMS WHERE itemid = :itemId`;
    const edlRes = await db.execute(edlQuery, { itemId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (edlRes.rows.length > 0) {
      edlType = edlRes.rows[0].EDL;
    }
  } catch (e) {
    console.error('Error fetching edl details:', e);
  }

  // 3. WH Stock (Ready & QC)
  let readyStock = 0, qcStock = 0;
  if (isMC) {
    const whReadyQcQueryMC = `
      select A.itemid,
             (case when sum( A.ReadyForIssue)>0 then sum( A.ReadyForIssue) else 0 end) as ReadyForIssue,
             (case when sum(nvl(Pending,0)) >0 then sum(nvl(Pending,0)) else 0 end) Pending 
      from  
      (  
        select mi.itemid,w.WAREHOUSENAME,mi.ITEMCODE, b.inwno,mi.ITEMNAME , mi.strength1 ,mi.unit as SKU , (case when b.qastatus ='1' then (nvl(b.absrqty,0) - nvl(iq.issueqty,0)) end) ReadyForIssue, 
        (case when b.qastatus = 0 or b.qastatus = 3 then (nvl(b.absrqty,0)- nvl(iq.issueqty,0)) end) Pending 
        from tbreceiptbatches b  
        inner join tbreceiptitems i on b.receiptitemid=i.receiptitemid 
        inner join tbreceipts t on t.receiptid=i.receiptid 
        inner join masitems mi on mi.itemid=i.itemid 
        inner join MASWAREHOUSES w  on w.warehouseid=t.warehouseid  
        left outer join 
        (  
          select  tb.warehouseid,tbi.itemid,tbo.inwno,sum(nvl(tbo.issueqty,0)) issueqty   
          from tboutwards tbo, tbindentitems tbi , tbindents tb 
          where  tbo.indentitemid=tbi.indentitemid and tbi.indentid=tb.indentid and tb.status = 'C' and tb.notindpdmis is null and tbo.notindpdmis is null and tbi.notindpdmis is null 
          group by tbi.itemid,tb.warehouseid,tbo.inwno  
        ) iq on b.inwno = Iq.inwno and iq.itemid=i.itemid and iq.warehouseid=t.warehouseid  
        Where  T.Status = 'C'  And (b.Whissueblock = 0 or b.Whissueblock is null)  and w.warehouseid= :whId and t.notindpdmis is null and b.notindpdmis is null  and i.notindpdmis is null 
      ) A 
      inner join masitems mia on mia.ITEMCODE=A.ITEMCODE  
      inner join masitemcategories mc on mc.CategoryID=mia.CategoryID
      where A.itemid= :itemId
      group by WAREHOUSENAME,A.itemcode,A.itemid
      having sum(nvl(A.ReadyForIssue,0)) >0 or  sum(nvl(A.Pending,0)) >0 
    `;
    try {
      const mcStockRes = await db.execute(whReadyQcQueryMC, { itemId, whId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (mcStockRes.rows.length > 0) {
        readyStock = parseInt(mcStockRes.rows[0].READYFORISSUE || 0) * unitCount;
        qcStock = parseInt(mcStockRes.rows[0].PENDING || 0) * unitCount;
      }
    } catch(e) {}
  } else {
    const stockQuery = `Select NVL(cgmscl.getStockWH1(:itemId, :whId), '0-0') as WHStock from dual`;
    try {
      const stockRes = await db.execute(stockQuery, { itemId, whId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (stockRes.rows.length > 0) {
        const data = stockRes.rows[0].WHSTOCK.split('-');
        readyStock = parseInt(data[0] || 0) * unitCount;
        qcStock = parseInt(data[1] || 0) * unitCount;
      }
    } catch(e) {}
  }

  // 4. Est Date
  let estDate = null;
  try {
    const estDateQuery = `Select cgmscl.getQCPassDate(:itemId, :whId) as EstDate from dual`;
    const estDateRes = await db.execute(estDateQuery, { itemId, whId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    estDate = estDateRes.rows.length > 0 ? estDateRes.rows[0].ESTDATE : null;
  } catch(e) {}

  // 5. Facility Stock
  const facStockQuery = `
    select sum(batchstock) as FACSTOCK
    from
    (
        select
            b.batchno,
            case
                when b.qastatus = '1'
                then (nvl(b.absrqty,0) - nvl(iq.issueqty,0))
            end as BatchStock,
            b.inwno,
            mi.itemid
        from tbfacilityreceiptbatches b
        inner join tbfacilityreceiptitems i on b.facreceiptitemid = i.facreceiptitemid
        inner join tbfacilityreceipts t on t.facreceiptid = i.facreceiptid
        inner join vmasitems mi on mi.itemid = i.itemid
        left outer join
        (
            select fs.facilityid, fsi.itemid, ftbo.inwno, sum(nvl(ftbo.issueqty,0)) as issueqty
            from tbfacilityissues fs
            inner join tbfacilityissueitems fsi on fsi.issueid = fs.issueid
            inner join tbfacilityoutwards ftbo on ftbo.issueitemid = fsi.issueitemid
            where fs.status = 'C' and fs.facilityid = :facilityId
            group by fsi.itemid, fs.facilityid, ftbo.inwno
        ) iq on b.inwno = iq.inwno and iq.itemid = i.itemid and iq.facilityid = t.facilityid
        where t.Status = 'C'
          and (b.Whissueblock = 0 or b.Whissueblock is null)
          and b.expdate > sysdate
          and t.facilityid = :facilityId
          and i.itemid = :itemId
          and (case when b.qastatus = '1' then (nvl(b.absrqty,0) - nvl(iq.issueqty,0)) end) > 0
    )
  `;
  let facStock = 0;
  try {
    const facStockRes = await db.execute(facStockQuery, { facilityId, itemId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    facStock = facStockRes.rows.length > 0 ? facStockRes.rows[0].FACSTOCK : 0;
  } catch(e) {}

  // 6. Annual Indent Details
  let balAiQty = 0, aiQty = 0, whIssueQty = 0, nocQty = 0, tranIssueQty = 0, tranQtyRecv = 0;

  if (isMC) {
    const aiQueryMC = `
      select 
        nvl(Indentqty,0)*nvl(m.unitcount,1) AIQTY,
        nvl(issueqty,0)*nvl(m.unitcount,1) WHISSUEQTY,
        nvl(Noc.NOcQty,0)*nvl(m.unitcount,1) NOCQTY,
        nvl(Indentqty-(nvl(issueqty,0)+nvl(Noc.NOcQty,0)),0)*nvl(m.unitcount,1) BALAIQTY 
      from masitems m
      left outer join (
        select  itemid,round(sum(nvl(facilityindentQTY,0))/nvl(unitcount,1),0) as Indentqty
        ,nvl(unitcount,1) unitcount
        from
        (
        select  distinct  ai.ANUALINDENTID, ai.itemid,nvl(ai.facilityindentQTY,0) as facilityindentQTY,nvl(m.unitcount,1) as unitcount
        from anualindent ai
        inner join dmeapproval dmai on dmai.indentid=ai.indentid  
        inner join  masitems m on m.itemid = ai.itemid
        where ai.status='C' and dmai.status='C' and ai.itemid=:itemId  and ai.facilityid=:facilityId 
        and ai.accyrsetid in (select accyrsetid from masaccyearsettings where sysdate between startdate and enddate)
        )
        group by itemid,unitcount
      ) II on II.itemid=m.itemid
      left outer join 
      (
        select  tb.facilityid,tbi.itemid,sum(tbo.issueqty) issueqty from tbindents tb
        inner join tbindentitems  tbi on tbi.indentid=tb.indentid
        inner join tboutwards  tbo on tbo.indentitemid=tbi.indentitemid
        where tb.facilityid=:facilityId  and tb.status='C' and tbi.itemid=:itemId
        and tb.indentdate between (select startdate from masaccyearsettings where sysdate between startdate and enddate and rownum = 1) and (select enddate from masaccyearsettings where sysdate between startdate and enddate and rownum = 1)
        group by tb.facilityid,tbi.itemid 
      ) Iss on Iss.itemid=m.itemid
      left outer join 
      (
        select mn.facilityid,mni.itemid,sum(mni.approvedqty) NOcQty from mascgmscnoc mn 
        inner join mascgmscnocitems  mni on mni.nocid=mn.nocid
        where mn.status='C'  and nvl(mni.ISCANCEL,'N')='N' and  facilityid=:facilityId and mni.itemid=:itemId
        and mn.nocdate between (select startdate from masaccyearsettings where sysdate between startdate and enddate and rownum = 1) and (select enddate from masaccyearsettings where sysdate between startdate and enddate and rownum = 1)
        group by mn.facilityid,mni.itemid 
      ) Noc on Noc.itemid=m.itemid where m.itemid=:itemId
    `;
    try {
      const aiResMC = await db.execute(aiQueryMC, { facilityId, itemId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (aiResMC.rows.length > 0) {
        balAiQty = aiResMC.rows[0].BALAIQTY;
        aiQty = aiResMC.rows[0].AIQTY;
        whIssueQty = aiResMC.rows[0].WHISSUEQTY;
        nocQty = aiResMC.rows[0].NOCQTY;
      }
    } catch(e) {}
  } else {
    const aiQueryDHS = `
      select nvl(Indentqty,0) Indentqty,
             nvl(issueqty,0)*nvl(m.unitcount,1) issueqty,
             nvl(Noc.NOcQty,0)*nvl(m.unitcount,1) NOcQty,
             (Indentqty+nvl(ITR.TranQtyRecv,0)) as totRecv,
             ((((nvl(issueqty,0)+nvl(Noc.NOcQty,0)))*nvl(m.unitcount,1) )+nvl(ITI.TranIssueQty,0)) as toIssue,
             nvl((nvl(Indentqty,0)+nvl(ITR.TranQtyRecv,0))-(( ( nvl(issueqty,0)+nvl(Noc.NOcQty,0) )*nvl(m.unitcount,1) )+nvl(ITI.TranIssueQty,0)),0) BalIndentqty,
             nvl(ITR.TranQtyRecv,0) as TranQtyRecv,
             nvl(ITI.TranIssueQty,0) as TranIssueQty 
      from masitems m
      left outer join (
        select ai.itemid, round(nvl(ai.cmhodistqty,0),0) as Indentqty, nvl(m.unitcount,1) unitcount
        from masanualindent ma
        inner join anualindent ai on ai.indentid=ma.indentid
        inner join masitems m on m.itemid=ai.itemid
        where ai.status='C' and ma.status='C' and ai.itemid = :itemId and ai.facilityid = :facilityId  
          and ai.accyrsetid in (select accyrsetid from masaccyearsettings where sysdate between startdate and enddate)
          and nvl(ai.cmhodistqty,0)>0 
      ) II on II.itemid=m.itemid
      left outer join 
      (
        select tb.facilityid, tbi.itemid, sum(tbo.issueqty) issueqty 
        from tbindents tb
        inner join tbindentitems tbi on tbi.indentid=tb.indentid
        inner join tboutwards tbo on tbo.indentitemid=tbi.indentitemid
        where tb.facilityid = :facilityId and tb.status='C' and tbi.itemid = :itemId
          and tb.indentdate between (select startdate from masaccyearsettings where sysdate between startdate and enddate and rownum = 1) 
                                and (select enddate from masaccyearsettings where sysdate between startdate and enddate and rownum = 1)
        group by tb.facilityid, tbi.itemid 
      ) Iss on Iss.itemid = :itemId
      left outer join 
      (
        select mn.facilityid, mni.itemid, sum(mni.approvedqty) NOcQty 
        from mascgmscnoc mn 
        inner join mascgmscnocitems mni on mni.nocid=mn.nocid
        where mn.status='C' and nvl(mni.ISCANCEL,'N')='N' and mn.facilityid = :facilityId and mni.itemid = :itemId
          and mn.nocdate between (select startdate from masaccyearsettings where sysdate between startdate and enddate and rownum = 1) 
                             and (select enddate from masaccyearsettings where sysdate between startdate and enddate and rownum = 1)
        group by mn.facilityid, mni.itemid 
      ) Noc on Noc.itemid = :itemId
      left outer join 
      (
        select itemid, sum(nvl(transferqty,0)) as TranQtyRecv
        from (
          select ai.transferqty, ai.itemid, a.facilityid
          from MASFACILITYAITRANSFER a
          inner join facilityaitransferitems ai on ai.aitransferid=a.aitransferid
          where a.status='C' and a.accyrsetid in (select accyrsetid from masaccyearsettings where sysdate between startdate and enddate)
            and a.facilityid = :facilityId and itemid = :itemId 
        ) group by itemid
      ) ITR on ITR.itemid = :itemId 
      left outer join 
      (
        select itemid, sum(nvl(transferqty,0)) as TranIssueQty
        from (
          select ai.transferqty, ai.itemid, ai.fromfacilityid as facilityid
          from MASFACILITYAITRANSFER a
          inner join facilityaitransferitems ai on ai.aitransferid=a.aitransferid
          where a.status='C' and a.accyrsetid in (select accyrsetid from masaccyearsettings where sysdate between startdate and enddate)
            and ai.fromfacilityid = :facilityId and itemid = :itemId 
        ) group by itemid
      ) ITI on ITI.itemid = :itemId 
      where m.itemid = :itemId
    `;
    try {
      const aiRes = await db.execute(aiQueryDHS, { facilityId, itemId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (aiRes.rows.length > 0) {
        balAiQty = Number(aiRes.rows[0].BALINDENTQTY) || 0;
        aiQty = Number(aiRes.rows[0].INDENTQTY) || 0;
        whIssueQty = Number(aiRes.rows[0].ISSUEQTY) || 0;
        nocQty = Number(aiRes.rows[0].NOCQTY) || 0;
        tranIssueQty = Number(aiRes.rows[0].TRANISSUEQTY) || 0;
        tranQtyRecv = Number(aiRes.rows[0].TRANQTYRECV) || 0;
      }
    } catch(e) {
      console.error('Error fetching DHS AI details:', e);
    }
  }

  // 7. Other WH Stock
  let otherWhStock = 0;
  if (isMC) {
    const otherWhQueryMC = `
      select nvl(sum(Ready_QC),0) stk from ( select (case when sum( A.ReadyForIssue)>0 then sum( A.ReadyForIssue) else 0 end)  Ready_QC
              from 
             (                   
                select w.WAREHOUSENAME,mi.ITEMCODE, b.inwno,mi.ITEMNAME , mi.strength1 ,mi.unit as SKU , (case when b.qastatus ='1' then (nvl(b.absrqty,0) - nvl(iq.issueqty,0)) else (case when mi.Qctest ='N' then (nvl(b.absrqty,0) - nvl(iq.issueqty,0) )  end ) end ) ReadyForIssue, 
             case when  mi.qctest='N' then 0 else (case when b.qastatus = 0 or b.qastatus = 3 then (nvl(b.absrqty,0)- nvl(iq.issueqty,0)) end) end  Pending 
              from tbreceiptbatches b  
              inner join tbreceiptitems i on b.receiptitemid=i.receiptitemid 
              inner join tbreceipts t on t.receiptid=i.receiptid 
              inner join masitems mi on mi.itemid=i.itemid 
             inner join MASWAREHOUSES w  on w.warehouseid=t.warehouseid  
             left outer join 
              (  
               select  tb.warehouseid,tbi.itemid,tbo.inwno,sum(nvl(tbo.issueqty,0)) issueqty   
               from tboutwards tbo, tbindentitems tbi , tbindents tb 
               where tbi.itemid = :itemId and  tbo.indentitemid=tbi.indentitemid and tbi.indentid=tb.indentid 
               and tb.notindpdmis is null and tbo.notindpdmis is null and tbi.notindpdmis is null 
               and tb.warehouseid  not in ( select warehouseid from masfacilitywh where facilityid = :facilityId )
               group by tbi.itemid,tb.warehouseid,tbo.inwno  
             ) iq on b.inwno = Iq.inwno and iq.itemid=i.itemid and iq.warehouseid=t.warehouseid 
             Where  T.Status = 'C' and (b.ExpDate >= SysDate or nvl(b.ExpDate,SysDate) >= SysDate)  And (b.Whissueblock = 0 or b.Whissueblock is null) 
             and  mi.itemid = :itemId and t.notindpdmis is null and b.notindpdmis is null  and i.notindpdmis is null 
            and w.warehouseid  not in ( select warehouseid from masfacilitywh where facilityid = :facilityId )
             ) A 
             group by WAREHOUSENAME,A.itemcode,A.ItemName, A.strength1,A.SKU  
            having sum(nvl(A.ReadyForIssue,0)) >0 or  sum(nvl(A.Pending,0)) >0 )
    `;
    try {
      const otherWhRes = await db.execute(otherWhQueryMC, { itemId, facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      otherWhStock = parseInt(otherWhRes.rows.length > 0 ? otherWhRes.rows[0].STK : 0) * unitCount;
    } catch(e) { }
  } else {
    const otherWhQueryDHS = `
      select nvl(sum(Ready_QC),0) stk from ( select (case when sum( A.ReadyForIssue)>0 then sum( A.ReadyForIssue) else 0 end) Ready_QC
      from 
      ( 
        select w.WAREHOUSENAME,mi.ITEMCODE, b.inwno,mi.ITEMNAME , mi.strength1 ,mi.unit as SKU , 
        (case when b.qastatus ='1' then (nvl(b.absrqty,0) - nvl(iq.issueqty,0)) * nvl(mi.unitcount,1) else (case when mi.Qctest ='N' then (nvl(b.absrqty,0) - nvl(iq.issueqty,0) ) * nvl(mi.unitcount,1) end ) end ) ReadyForIssue, 
        case when mi.qctest='N' then 0 else (case when b.qastatus = 0 or b.qastatus = 3 then (nvl(b.absrqty,0)- nvl(iq.issueqty,0)) * nvl(mi.unitcount,1) end) end Pending 
        from tbreceiptbatches b 
        inner join tbreceiptitems i on b.receiptitemid=i.receiptitemid 
        inner join tbreceipts t on t.receiptid=i.receiptid 
        inner join masitems mi on mi.itemid=i.itemid 
        inner join MASWAREHOUSES w on w.warehouseid=t.warehouseid 
        left outer join 
        ( 
          select tb.warehouseid,tbi.itemid,tbo.inwno,sum(nvl(tbo.issueqty,0)) issueqty 
          from tboutwards tbo, tbindentitems tbi , tbindents tb 
          where tbi.itemid = :itemId and tbo.indentitemid=tbi.indentitemid and tbi.indentid=tb.indentid 
            and tb.notindpdmis is null and tbo.notindpdmis is null and tbi.notindpdmis is null 
            and tb.warehouseid not in ( select warehouseid from masfacilitywh where facilityid= :facilityId)
          group by tbi.itemid,tb.warehouseid,tbo.inwno 
        ) iq on b.inwno = Iq.inwno and iq.itemid=i.itemid and iq.warehouseid=t.warehouseid 
        Where T.Status = 'C' and (b.ExpDate >= SysDate or nvl(b.ExpDate,SysDate) >= SysDate) And (b.Whissueblock = 0 or b.Whissueblock is null) 
          and mi.itemid = :itemId and t.notindpdmis is null and b.notindpdmis is null and i.notindpdmis is null 
          and w.warehouseid not in ( select warehouseid from masfacilitywh where facilityid= :facilityId)
      ) A 
      group by WAREHOUSENAME,A.itemcode,A.ItemName, A.strength1,A.SKU 
      having sum(nvl(A.ReadyForIssue,0)) >0 or sum(nvl(A.Pending,0)) >0 )
    `;
    try {
      const otherWhRes = await db.execute(otherWhQueryDHS, { itemId, facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (otherWhRes.rows.length > 0) {
        otherWhStock = Number(otherWhRes.rows[0].STK) || 0;
      }
    } catch(e) {
      console.error('Error fetching DHS other WH stock:', e);
    }
  }

  return {
    whStock: readyStock,
    qcStock: qcStock,
    estDate: estDate,
    facStock: facStock || 0,
    aiQty,
    whIssueQty,
    nocQty,
    balAiQty,
    tranIssueQty,
    tranQtyRecv,
    otherWhStock,
    unitCount,
    strength,
    sku,
    itemTypeName,
    edlType
  };
}

module.exports = {
  getPrograms,
  getItemCategories,
  getItemTypes,
  getNocList,
  getIncompleteNoc,
  generateNocNumber,
  createNocHeader,
  updateNocHeader,
  deleteNoc,
  completeNoc,
  checkNocIndent,
  getNocById,
  getNocItems,
  saveNocItem,
  updateNocItem,
  deleteNocItem,
  getFmItemsForFacility,
  getWarehouseItemsForFacility,
  getDhsIndentItemsForFacility,
  getAgainstApprovalIndentItemsForFacility,
  getOtherItemForFacility,
  getItemStockDetails,
  checkNocCancel,
  checkItemIsActive,
  isItemExist,
};
