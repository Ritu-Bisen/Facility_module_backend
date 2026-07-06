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
    ORDER BY a.NOCDATE
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
    `SELECT SHAccYear FROM masAccYearSettings WHERE SYSDATE BETWEEN StartDate AND EndDate`,
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
 * Mirrors ltbndelete_Click from CgmsclNocMainDHS.aspx.cs
 */
async function deleteNoc(nocId) {
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
 */
async function completeNoc(nocId) {
  await db.execute(
    `UPDATE MASCGMSCNOC SET STATUS = 'C' WHERE NOCID = :nocId`,
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
 */
async function getNocItems(nocId) {
  const query = `
    SELECT
      b.SR as NOCITEMID,
      b.NOCID,
      b.ITEMID,
      m.ITEMCODE,
      m.ITEMNAME,
      m.STRENGTH1,
      m.UNIT,
      b.REQUESTEDQTY,
      b.WHSTOCK,
      NVL(b.WHSTOCKQCPENDING, 0) AS WHSTOCKQCPENDING,
      NVL(b.BOOKEDQTY, 0)   AS BOOKEDQTY,
      NVL(b.APPROVEDQTY, 0) AS APPROVEDQTY,
      NVL(b.STOCKINHAND, 0) AS STOCKINHAND,
      b.ITEMREMARKS as REMARKS
    FROM MASCGMSCNOCITEMS b
    INNER JOIN MASITEMS m ON m.ITEMID = b.ITEMID
    WHERE b.NOCID = :nocId
    ORDER BY b.SR
  `;
  const result = await db.execute(query, { nocId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows;
}

async function saveNocItem({
  nocId, itemId, requestedqty, whStock, itemRemarks,
  whStockQcPending, estimatedDate, whId, cgmsclRemarks,
  otherWhStock, stockInHand, itemType
}) {
  const reqQty = Number(requestedqty) || 0;
  const availStock = Number(whStock) || 0;
  
  let bookedQty = 0;
  let approvedQty = 0;
  let bookedFlag = 'N';
  let computedRemarks = cgmsclRemarks || null;
  
  if (availStock >= reqQty) {
    bookedQty = reqQty;
    approvedQty = 0;
    bookedFlag = 'Y';
    computedRemarks = "Fully Booked";
  } else if (availStock > 0) {
    bookedQty = availStock;
    approvedQty = reqQty - availStock;
    bookedFlag = 'Y';
    computedRemarks = "Partially Booked";
  } else {
    bookedQty = 0;
    approvedQty = reqQty;
    bookedFlag = 'N';
    computedRemarks = "Not Booked";
  }

  const query = `
    INSERT INTO MASCGMSCNOCITEMS
      (NOCID, ITEMID, REQUESTEDQTY, WHSTOCK, ITEMREMARKS, 
       WHSTOCKQCPENDING, ESTIMATEDDATE, WHID, CGMSCLREMARKS, 
       OTHERWHSTOCK, STATUS, APPROVEDQTY, BOOKEDQTY, BOOKEDFLAG, STOCKINHAND)
    VALUES
      (:nocId, :itemId, :requestedqty, :whStock, :itemRemarks, 
       :whStockQcPending, TO_DATE(:estimatedDate, 'yyyy-mm-dd'), :whId, :cgmsclRemarks, 
       :otherWhStock, 'I', :approvedQty, :bookedQty, :bookedFlag, :stockInHand)
    RETURNING SR INTO :nocItemId
  `;
  const binds = {
    nocId,
    itemId,
    requestedqty: reqQty,
    whStock: availStock,
    itemRemarks: itemRemarks || null,
    whStockQcPending: whStockQcPending || 0,
    estimatedDate: estimatedDate || null,
    whId: whId || null,
    cgmsclRemarks: computedRemarks,
    otherWhStock: otherWhStock || 0,
    approvedQty,
    bookedQty,
    bookedFlag,
    stockInHand: stockInHand || 0,
    nocItemId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
  };
  const result = await db.execute(query, binds, { autoCommit: true });
  return result.outBinds.nocItemId[0];
}

/**
 * Update an existing NOC item row.
 */
async function updateNocItem({ nocItemId, requestedqty }) {
  const fetchQuery = `SELECT WHSTOCK FROM MASCGMSCNOCITEMS WHERE SR = :nocItemId`;
  const res = await db.execute(fetchQuery, { nocItemId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  if (!res.rows || res.rows.length === 0) throw new Error("Item not found");
  
  const availStock = Number(res.rows[0].WHSTOCK) || 0;
  const reqQty = Number(requestedqty) || 0;
  
  let bookedQty = 0;
  let approvedQty = 0;
  let bookedFlag = 'N';
  let computedRemarks = null;
  
  if (availStock >= reqQty) {
    bookedQty = reqQty;
    approvedQty = 0;
    bookedFlag = 'Y';
    computedRemarks = "Fully Booked";
  } else if (availStock > 0) {
    bookedQty = availStock;
    approvedQty = reqQty - availStock;
    bookedFlag = 'Y';
    computedRemarks = "Partially Booked";
  } else {
    bookedQty = 0;
    approvedQty = reqQty;
    bookedFlag = 'N';
    computedRemarks = "Not Booked";
  }

  const query = `
    UPDATE MASCGMSCNOCITEMS
    SET REQUESTEDQTY  = :requestedqty,
        BOOKEDQTY     = :bookedQty,
        APPROVEDQTY   = :approvedQty,
        BOOKEDFLAG    = :bookedFlag,
        CGMSCLREMARKS = :computedRemarks
    WHERE SR = :nocItemId
  `;
  await db.execute(
    query,
    { nocItemId, requestedqty: reqQty, bookedQty, approvedQty, bookedFlag, computedRemarks },
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
async function getFmItemsForFacility(facilityId, itemType) {
  const query = `
    SELECT l.itemid, l.ITEMCODE, l.ITEMNAME, l.STRENGTH1, l.UNIT, l.UNITCOUNT, l.edl,
           READYQTY*nvl(UNITCOUNT,1) as ReadyStockWHNos,
           UQQTY*nvl(UNITCOUNT,1) as UQCStockWHNos,
           IWHPIPQTY*nvl(UNITCOUNT,1) as IWHPiplineStockNos,
           CGMSCFM, GROUPNAME, ITEMTYPENAME, e.edlcat, l.RECEIPTDATEWH, l.QCPASSEDDT,
           nvl(facstock.itemstock,0) as FACILITYSTOCK
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
    WHERE mcid = 1 
      AND WAREHOUSEID = 2617 
      AND CGMSCFM = :itemType
      AND (nvl(READYQTY,0) + nvl(UQQTY,0) + nvl(IWHPIPQTY,0)) > 0
      AND e.edlcat <= (SELECT eldcat FROM masfacilityTypes ty 
                       INNER JOIN masfacilities f ON f.facilitytypeid = ty.facilitytypeid 
                       WHERE f.facilityid = :facilityId)
    ORDER BY GROUPNAME, ITEMNAME
  `;
  const binds = { facilityId, itemType };
  const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows;
}

/**
 * Get Available or Stock Out items from the warehouse for the facility.
 * itemType should be 'AVAILABLE', 'STOCKOUT', or 'STOCK_AND_AVAILABLE'.
 */
async function getWarehouseItemsForFacility(facilityId, itemType) {
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
       nvl(facstock.itemstock,0) as FACILITYSTOCK
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

where mcid=1

and WAREHOUSEID in
(
    select warehouseid
    from MASFACILITYWH
    where facilityid = :facilityId
)

and ${qtyCondition}

and e.edlcat <=
(
    select eldcat
    from masfacilityTypes ty
    inner join masfacilities f
        on f.facilitytypeid = ty.facilitytypeid
    where f.facilityid = :facilityId
)

ORDER BY GROUPNAME, ITEMNAME
  `;
  const binds = { facilityId };
  const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows;
}

/**
 * Get DHS Indent items from the warehouse for the facility.
 */
async function getDhsIndentItemsForFacility(facilityId) {
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
    nvl(facstock.itemstock,0) as FACILITYSTOCK
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

where mcid = 1
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
  const binds = { facilityId };
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
        nvl(facstock.itemstock,0) as FACILITYSTOCK
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
    where mcid = 1
      and warehouseid = 2617
      and itemcode = :itemCode
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

module.exports = {
  getPrograms,
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
  getOtherItemForFacility,
};
