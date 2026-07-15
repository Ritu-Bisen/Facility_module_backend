const oracledb = require('oracledb');
const db = require('../config/db');

async function getIndents(facilityId, yearId, status) {
    let statusFilter = '';
    const binds = { facilityId, yearId };

    if (status && status !== 'All') {
        statusFilter = ` AND a.Status = :status `;
        binds.status = status;
    }

    const query = `
        SELECT 
            a.IndentID   as "NOCID",
            a.DispatchNo as "DispatchNo",
            TO_CHAR(a.DispatchDate, 'DD-MM-YYYY') as "DispatchDate",
            a.IndentNo   as "NOCNumber",
            TO_CHAR(a.IndentDate, 'DD-MM-YYYY') as "NOCDATE",
            CASE a.Status  
                WHEN 'A' THEN 'Approved'  
                WHEN 'I' THEN 'Incomplete'
                WHEN 'S' THEN 'Sent for Approval'  
                WHEN 'C' THEN 'Completed'  
                WHEN 'D' THEN 'Deleted' 
            END as "Status",
            a.Status     as "StatusCode",
            c.AccYear    as "AccYear",
            a.FacilityID as "facilityid",
            f.FacilityName as "facilityname"
        FROM MASFACTRANSFERS a
        INNER JOIN masAccYearSettings c ON a.AccYrSetID = c.AccYrSetID 
        INNER JOIN masFacilities f ON f.FacilityID = a.FromFacilityID
        WHERE a.FacilityID = :facilityId
          AND a.AccYrSetID = :yearId
          ${statusFilter}
        ORDER BY a.IndentDate DESC
    `;

    const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows || [];
}

async function createIndent(facilityId, fromFacilityId, yearId, indentDate) {
    let connection;
    try {
        connection = await oracledb.getConnection();

        // 1. Get financial year short code (e.g., '25-26') from SHAccYear column
        const yrQuery = `SELECT SHAccYear FROM masAccYearSettings WHERE AccYrSetID = :yearId`;
        const yrResult = await connection.execute(yrQuery, { yearId });
        if (!yrResult.rows || yrResult.rows.length === 0) {
            throw new Error('Invalid financial year ID');
        }
        const shAccYear = yrResult.rows[0][0]; // e.g. "25-26"

        // 2. Generate next AUTO_CODE using MAX(AUTO_CODE) per facility + year
        //    Exact logic from legacy: LPAD(NVL(MAX(TO_NUMBER(AUTO_CODE)),0)+1, 5, '0')
        const seqQuery = `
            SELECT LPAD(NVL(MAX(TO_NUMBER(AUTO_CODE)), 0) + 1, 5, '0') AS SOCODE
            FROM MASFACTRANSFERS
            WHERE FACILITYID  = :facilityId
              AND ACCYRSETID  = :yearId
        `;
        const seqResult = await connection.execute(seqQuery, { facilityId, yearId });
        const autoCode = seqResult.rows[0][0]; // e.g. "00004"

        // 3. Build indent number: FACILITYID/FI<AUTO_CODE>/<YEAR>
        //    e.g. 23197/FI00004/25-26
        const indentNo = `${facilityId}/FI${autoCode}/${shAccYear}`;

        // 4. Use provided indent date or today
        const parsedDate = indentDate ? new Date(indentDate) : new Date();

        // 5. INSERT into MASFACTRANSFERS (exact columns from legacy)
        const insertQuery = `
            INSERT INTO MASFACTRANSFERS (
                FROMFACILITYID,
                PROGRAMID,
                ACCYRSETID,
                FACILITYID,
                INDENTNO,
                INDENTDATE,
                STATUS,
                AUTO_CODE
            ) VALUES (
                :fromFacilityId,
                1,
                :yearId,
                :facilityId,
                :indentNo,
                :indentDate,
                'I',
                :autoCode
            ) RETURNING INDENTID INTO :newId
        `;

        const insertBinds = {
            fromFacilityId: Number(fromFacilityId),
            yearId:         Number(yearId),
            facilityId:     Number(facilityId),
            indentNo,
            indentDate:     parsedDate,
            autoCode,
            newId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
        };

        const insertResult = await connection.execute(insertQuery, insertBinds, { autoCommit: true });
        const indentId = insertResult.outBinds.newId[0];

        return {
            IndentID: indentId,
            IndentNo: indentNo,
            AutoCode: autoCode
        };

    } catch (error) {
        console.error('Error creating indent:', error);
        throw error;
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
}

module.exports = {
    getIndents,
    createIndent,
    getItemsForFacility,
    saveIndentItem,
    getIndentDetail,
    deleteIndentItem,
    updateIndent,
    deleteIndent,
    editIndentItem,
    completeIndent
};

// ─── Complete Indent ──────────────────────────────────────────────────────────
async function completeIndent(indentId) {
    // 1. Check if there are any items
    const checkQuery = `SELECT COUNT(*) AS cnt FROM MASFACDEMANDITEMS WHERE INDENTID = :indentId`;
    const checkResult = await db.execute(checkQuery, { indentId });
    const count = checkResult.rows[0][0];
    
    if (count === 0) {
        throw new Error("Please enter Item details first.");
    }

    // 2. Update status and date
    const updateQuery = `
        UPDATE MASFACTRANSFERS 
        SET STATUS = 'C', INDENTDATE = SYSDATE 
        WHERE INDENTID = :indentId
    `;
    await db.execute(updateQuery, { indentId }, { autoCommit: true });
    return true;
}

// ─── Get full indent detail (header + saved items) for edit mode ──────────────
async function getIndentDetail(indentId) {
    // Header
    const headerQuery = `
        SELECT
            a.INDENTID      AS "IndentID",
            a.INDENTNO      AS "IndentNo",
            TO_CHAR(a.INDENTDATE, 'DD-MM-YYYY') AS "IndentDate",
            a.FACILITYID    AS "FacilityID",
            a.FROMFACILITYID AS "FromFacilityID",
            a.ACCYRSETID    AS "AccYrSetID",
            a.STATUS        AS "Status",
            f.FACILITYNAME  AS "FacilityName",
            ff.FACILITYNAME AS "FromFacilityName",
            c.SHACCYEAR     AS "ShAccYear"
        FROM MASFACTRANSFERS a
        INNER JOIN masFacilities f  ON f.FACILITYID  = a.FACILITYID
        INNER JOIN masFacilities ff ON ff.FACILITYID = a.FROMFACILITYID
        INNER JOIN masAccYearSettings c ON c.ACCYRSETID = a.ACCYRSETID
        WHERE a.INDENTID = :indentId
    `;
    const headerResult = await db.execute(headerQuery, { indentId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const header = (headerResult.rows || [])[0] || null;

    // Saved items
    const itemsQuery = `
        SELECT
            d.ITEMID        AS "itemId",
            d.REQUESTEDQTY  AS "requestedQty",
            d.APPROVEDQTY   AS "approvedQty",
            d.FACSTOCK      AS "facStock",
            d.STATUS        AS "status",
            CASE WHEN mi.EDLITEMCODE IS NOT NULL THEN mi.EDLITEMCODE ELSE mi.ITEMCODE END AS "itemCode",
            mi.ITEMNAME     AS "itemName",
            mi.STRENGTH1    AS "strength",
            mi.UNIT         AS "sku",
            ty.ITEMTYPENAME AS "itemType",
            mi.UNITCOUNT    AS "packQty",
            NVL(mvm.EDLTYPE2025, 'Non EDL') AS "edlType"
        FROM MASFACDEMANDITEMS d
        INNER JOIN vmasitems mi     ON mi.ITEMID     = d.ITEMID
        LEFT  JOIN masitemtypes ty  ON ty.ITEMTYPEID = mi.ITEMTYPEID
        LEFT  JOIN mv_masitems mvm  ON mvm.ITEMCODE  = mi.EDLITEMCODE
        WHERE d.INDENTID = :indentId
        ORDER BY mi.ITEMNAME
    `;
    const itemsResult = await db.execute(itemsQuery, { indentId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const items = itemsResult.rows || [];

    return { header, items };
}

// ─── Get items in stock for a facility (used to populate item rows) ──────────
async function getItemsForFacility(facilityId) {
    const query = `
        SELECT
            mi.ITEMID                                         AS "itemId",
            CASE
                WHEN mi.EDLITEMCODE IS NOT NULL THEN mi.EDLITEMCODE
                ELSE mi.ITEMCODE
            END                                               AS "itemCode",
            mi.ITEMNAME                                       AS "itemName",
            mi.STRENGTH1                                      AS "strength",
            mi.UNIT                                           AS "sku",
            ty.ITEMTYPENAME                                   AS "itemType",
            mi.UNITCOUNT                                      AS "packQty",
            NVL(mvm.EDLTYPE2025, 'Non EDL')                  AS "edlType",
            SUM(
                CASE
                    WHEN b.QASTATUS = '1'
                    THEN NVL(b.ABSRQTY,0) - NVL(iq.ISSUEQTY,0)
                    ELSE 0
                END
            )                                                 AS "facilityStock"
        FROM tbfacilityreceiptbatches b
        INNER JOIN tbfacilityreceiptitems i   ON b.facreceiptitemid = i.facreceiptitemid
        INNER JOIN tbfacilityreceipts t       ON t.facreceiptid = i.facreceiptid
        INNER JOIN vmasitems mi               ON mi.itemid = i.itemid
        LEFT  JOIN masitemtypes ty            ON ty.itemtypeid = mi.itemtypeid
        LEFT  JOIN mv_masitems mvm            ON mvm.itemcode = mi.edlitemcode
        LEFT  JOIN (
            SELECT fs.facilityid, fsi.itemid, ftbo.inwno,
                   SUM(NVL(ftbo.issueqty,0)) AS issueqty
            FROM   tbfacilityissues fs
            INNER  JOIN tbfacilityissueitems fsi  ON fsi.issueid = fs.issueid
            INNER  JOIN tbfacilityoutwards ftbo   ON ftbo.issueitemid = fsi.issueitemid
            WHERE  fs.status = 'C'
            GROUP  BY fs.facilityid, fsi.itemid, ftbo.inwno
        ) iq
            ON iq.facilityid = t.facilityid
           AND iq.itemid     = i.itemid
           AND iq.inwno      = b.inwno
        WHERE t.status = 'C'
          AND (b.whissueblock = 0 OR b.whissueblock IS NULL)
          AND b.expdate > SYSDATE
          AND t.facilityid = :facilityId
        GROUP BY
            mi.ITEMID, mi.ITEMCODE, mi.EDLITEMCODE, mi.ITEMNAME,
            mi.STRENGTH1, mi.UNIT, ty.ITEMTYPENAME, mi.UNITCOUNT, mvm.EDLTYPE2025
        HAVING SUM(
            CASE
                WHEN b.QASTATUS = '1'
                THEN NVL(b.ABSRQTY,0) - NVL(iq.ISSUEQTY,0)
                ELSE 0
            END
        ) > 0
        ORDER BY mi.ITEMNAME
    `;
    const result = await db.execute(query, { facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows || [];
}

// ─── Insert one item row to MASFACDEMANDITEMS ───────────────────────────────────
async function saveIndentItem(indentId, itemId, requestedQty, approvedQty, facStock, stockInHand, status) {
    const query = `
        INSERT INTO MASFACDEMANDITEMS (ITEMID, INDENTID, REQUESTEDQTY, APPROVEDQTY, FACSTOCK, STOCKINHAND, STATUS)
        VALUES (:itemId, :indentId, :requestedQty, :approvedQty, :facStock, :stockInHand, :status)
    `;
    await db.execute(query, { itemId, indentId, requestedQty, approvedQty, facStock, stockInHand, status }, { autoCommit: true });
    return true;
}

// ─── Update one item row in MASFACDEMANDITEMS ───────────────────────────────────
async function editIndentItem(indentId, itemId, requestedQty, approvedQty) {
    const query = `
        UPDATE MASFACDEMANDITEMS
        SET REQUESTEDQTY = :requestedQty, APPROVEDQTY = :approvedQty
        WHERE INDENTID = :indentId AND ITEMID = :itemId
    `;
    await db.execute(query, { requestedQty, approvedQty, indentId, itemId }, { autoCommit: true });
    return true;
}

// ─── Delete one item row from MASFACDEMANDITEMS ───────────────────────────────
async function deleteIndentItem(indentId, itemId) {
    const query = `
        DELETE FROM MASFACDEMANDITEMS
        WHERE INDENTID = :indentId AND ITEMID = :itemId
    `;
    await db.execute(query, { indentId, itemId }, { autoCommit: true });
    return true;
}

// ─── Update Indent Header ─────────────────────────────────────────────────────
async function updateIndent(indentId, fromFacilityId, accYrSetId) {
    const query = `
        UPDATE MASFACTRANSFERS
        SET FROMFACILITYID = :fromFacilityId,
            ACCYRSETID = :accYrSetId
        WHERE INDENTID = :indentId
    `;
    await db.execute(query, { fromFacilityId, accYrSetId, indentId }, { autoCommit: true });
    return true;
}

// ─── Delete Entire Indent ─────────────────────────────────────────────────────
async function deleteIndent(indentId) {
    // Delete items first
    await db.execute(`DELETE FROM MASFACDEMANDITEMS WHERE INDENTID = :indentId`, { indentId }, { autoCommit: false });
    // Delete header
    await db.execute(`DELETE FROM MASFACTRANSFERS WHERE INDENTID = :indentId`, { indentId }, { autoCommit: true });
    return true;
}
