const db = require('../config/db');
const oracledb = require('oracledb');

/**
 * Format date helpers
 */
function parseDateParts(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.replace(/-/g, '/').split('/');
  if (parts.length === 2) {
    // MM/YYYY -> 01/MM/YYYY
    return {
      day: '01',
      month: parts[0].padStart(2, '0'),
      year: parts[1]
    };
  } else if (parts.length === 3) {
    return {
      day: parts[0].padStart(2, '0'),
      month: parts[1].padStart(2, '0'),
      year: parts[2]
    };
  }
  return null;
}

function formatDateForDb(dateStr, isExpiry = false) {
  if (!dateStr) return null;
  const parts = dateStr.replace(/-/g, '/').split('/');
  if (parts.length === 2) {
    const month = parseInt(parts[0], 10);
    const year = parseInt(parts[1], 10);
    if (isExpiry) {
      // Days in month
      const lastDay = new Date(year, month, 0).getDate();
      return `${String(lastDay).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
    } else {
      return `01-${String(month).padStart(2, '0')}-${year}`;
    }
  } else if (parts.length === 3) {
    return `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`;
  }
  return dateStr;
}

function isDateGreaterThanToday(dateStr) {
  if (!dateStr) return false;
  const parts = dateStr.replace(/-/g, '/').split('/');
  if (parts.length === 2) {
    const month = parseInt(parts[0], 10);
    const year = parseInt(parts[1], 10);
    const d = new Date(year, month - 1, 1);
    const now = new Date();
    if (d.getFullYear() > now.getFullYear()) return true;
    if (d.getFullYear() === now.getFullYear() && d.getMonth() > now.getMonth()) return true;
    return false;
  } else if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    const now = new Date();
    d.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    return d.getTime() > now.getTime();
  }
  return false;
}

/**
 * 1. Get Special Receipts List (SPFacilityReceiptsOther.aspx)
 */
async function getSpecialReceiptsList(req, res) {
  try {
    const facilityId = req.user?.facilityId;
    if (!facilityId) {
      return res.status(400).json({ success: false, message: 'Facility ID is required' });
    }

    const query = `
      SELECT 
        fr.FACRECEIPTID AS "receiptId",
        fr.FACRECEIPTNO AS "receiptNo",
        TO_CHAR(fr.FACRECEIPTDATE, 'DD-MM-YYYY') AS "receiptDate",
        NVL(s.NAME, '') AS "receiptFrom",
        fr.SPLOCATIONID AS "spLocationId",
        NVL(fr.STATUS, 'I') AS "status"
      FROM tbfacilityreceipts fr
      LEFT OUTER JOIN massplocation s ON s.ID = fr.SPLOCATIONID
      WHERE fr.FACILITYID = :facilityId 
        AND fr.FACRECEIPTTYPE = 'SP'
        AND (fr.SPTYPE = 'Y' OR fr.SPLOCATIONID IS NOT NULL)
        AND NVL(fr.STATUS, 'I') != 'C'
      ORDER BY fr.FACRECEIPTDATE DESC, fr.FACRECEIPTID DESC
    `;

    const result = await db.execute(query, { facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const list = (result.rows || []).map(row => ({
      receiptId: String(row.receiptId || row.RECEIPTID),
      receiptNo: row.receiptNo || row.RECEIPTNO || '',
      receiptDate: row.receiptDate || row.RECEIPTDATE || '',
      receiptFrom: row.receiptFrom || row.RECEIPTFROM || '',
      spLocationId: row.spLocationId || row.SPLOCATIONID || '',
      status: (row.status || row.STATUS || 'I').toUpperCase()
    }));

    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Error fetching special receipts list:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 2. Get Receipt From dropdown locations (massplocation)
 */
async function getSpLocations(req, res) {
  try {
    const facilityId = req.user?.facilityId;
    if (!facilityId) {
      return res.status(400).json({ success: false, message: 'Facility ID is required' });
    }

    const query = `
      SELECT ID AS "id", NAME AS "name"
      FROM massplocation
      WHERE facilityid = :facilityId
      ORDER BY NAME
    `;

    const result = await db.execute(query, { facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    res.json({ success: true, data: result.rows || [] });
  } catch (error) {
    console.error('Error fetching SP locations:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 3. Get Stock Locations (masracks)
 */
async function getStorageLocations(req, res) {
  try {
    const facilityId = req.user?.facilityId;
    if (!facilityId) {
      return res.status(400).json({ success: false, message: 'Facility ID is required' });
    }

    const query = `
      SELECT NVL(RackID, 0) AS "rackId", NVL(locationno, 'Null') AS "locationNo"
      FROM masracks
      WHERE warehouseid = :facilityId
      ORDER BY locationno
    `;

    const result = await db.execute(query, { facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    res.json({ success: true, data: result.rows || [] });
  } catch (error) {
    console.error('Error fetching storage locations:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 4. Get Header Info
 */
async function getHeaderInfo(req, res) {
  try {
    const facilityId = req.user?.facilityId;
    const { receiptId } = req.query;

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const todayFormatted = `${dd}-${mm}-${yyyy}`;

    if (!receiptId || receiptId === '0') {
      return res.json({
        success: true,
        data: {
          receiptId: '0',
          receiptNo: 'Auto generated',
          receiptDate: todayFormatted,
          spLocationId: '',
          receiptFromName: '',
          status: 'I',
          remarks: '',
          stkRegNo: '',
          stkRegDate: ''
        }
      });
    }

    const query = `
      SELECT 
        fr.FACRECEIPTID AS "receiptId",
        fr.FACRECEIPTNO AS "receiptNo",
        TO_CHAR(fr.FACRECEIPTDATE, 'DD-MM-YYYY') AS "receiptDate",
        fr.SPLOCATIONID AS "spLocationId",
        NVL(s.NAME, '') AS "receiptFromName",
        fr.REMARKS AS "remarks",
        fr.STKREGNO AS "stkRegNo",
        TO_CHAR(fr.STKREGDATE, 'DD-MM-YYYY') AS "stkRegDate",
        NVL(fr.STATUS, 'I') AS "status"
      FROM tbfacilityreceipts fr
      LEFT OUTER JOIN massplocation s ON s.ID = fr.SPLOCATIONID
      WHERE fr.FACRECEIPTID = :receiptId AND fr.FACILITYID = :facilityId
    `;

    const result = await db.execute(query, { receiptId: Number(receiptId), facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Special receipt not found' });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        receiptId: String(row.receiptId || row.RECEIPTID),
        receiptNo: row.receiptNo || row.RECEIPTNO,
        receiptDate: row.receiptDate || row.RECEIPTDATE,
        spLocationId: row.spLocationId != null ? String(row.spLocationId || row.SPLOCATIONID) : '',
        receiptFromName: row.receiptFromName || row.RECEIPTFROMNAME || '',
        remarks: row.remarks || row.REMARKS || '',
        stkRegNo: row.stkRegNo || row.STKREGNO || '',
        stkRegDate: row.stkRegDate || row.STKREGDATE || '',
        status: (row.status || row.STATUS || 'I').toUpperCase()
      }
    });
  } catch (error) {
    console.error('Error fetching header:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 5. Save or Update Header Info
 */
async function updateHeaderInfo(req, res) {
  try {
    const facilityId = req.user?.facilityId;
    if (!facilityId) {
      return res.status(400).json({ success: false, message: 'Facility ID is required' });
    }

    const { receiptId, receiptDate, spLocationId } = req.body;

    if (!receiptDate) {
      return res.status(400).json({ success: false, message: 'Receipt Date is required.' });
    }
    if (!spLocationId) {
      return res.status(400).json({ success: false, message: 'Receipt From location is required.' });
    }

    if (isDateGreaterThanToday(receiptDate)) {
      return res.status(400).json({ success: false, message: 'Receipt date cannot be greater than today.' });
    }

    const formattedDate = formatDateForDb(receiptDate);

    // Create New Receipt
    if (!receiptId || receiptId === '0') {
      // 1. Get facility code
      const facRes = await db.execute(
        'SELECT FacilityCode FROM masFacilities WHERE FacilityID = :facilityId',
        { facilityId: Number(facilityId) },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const facCode = facRes.rows && facRes.rows.length > 0 
        ? (facRes.rows[0].FACILITYCODE || facRes.rows[0].facilityCode || '') 
        : '';
      const finalFacCode = facCode || String(facilityId);

      // 2. Get AccYear
      const yrRes = await db.execute(
        'SELECT SHAccYear FROM masAccYearSettings WHERE SYSDATE BETWEEN StartDate AND EndDate',
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      let shAccYear;
      if (!yrRes.rows || yrRes.rows.length === 0) {
        const d = new Date();
        const y = d.getFullYear();
        const m = d.getMonth();
        shAccYear = m >= 3 
          ? `${y.toString().slice(-2)}-${(y + 1).toString().slice(-2)}` 
          : `${(y - 1).toString().slice(-2)}-${y.toString().slice(-2)}`;
      } else {
        shAccYear = yrRes.rows[0].SHACCYEAR || yrRes.rows[0].shAccYear;
      }

      // 3. Get next sequence
      const pattern = `${finalFacCode}/SP/%/${shAccYear}`;
      let nextSeq = '00001';
      try {
        const seqRes = await db.execute(`
          SELECT LPAD(NVL(MAX(
            CASE WHEN REGEXP_LIKE(SUBSTR(FacReceiptNo, -11, 5), '^[0-9]+$')
                 THEN TO_NUMBER(SUBSTR(FacReceiptNo, -11, 5))
                 ELSE 0
            END
          ), 0) + 1, 5, '0') AS NEXTSEQ
          FROM tbFacilityReceipts
          WHERE FacReceiptNo LIKE :pattern
        `, { pattern }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

        if (seqRes.rows && seqRes.rows.length > 0) {
          nextSeq = seqRes.rows[0].NEXTSEQ || seqRes.rows[0].nextSeq || '00001';
        }
      } catch (seqErr) {
        console.warn('Sequence query warning, using fallback:', seqErr);
      }

      const facReceiptNo = `${finalFacCode}/SP/${nextSeq}/${shAccYear}`;

      // 4. Generate next FacReceiptID
      let newReceiptId = 1;
      try {
        const seqFacSql = `SELECT NVL(MAX(FACRECEIPTID), 0) + 1 AS "NEWID" FROM tbFacilityReceipts`;
        const seqFacRes = await db.execute(seqFacSql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        if (seqFacRes.rows && seqFacRes.rows.length > 0) {
          newReceiptId = Number(seqFacRes.rows[0].NEWID || seqFacRes.rows[0].newId || 1);
        }
      } catch (idErr) {
        console.warn('FacReceiptID query warning, using fallback:', idErr);
      }

      // 5. Insert record
      const insertSql = `
        INSERT INTO tbFacilityReceipts (
          FACRECEIPTID, FacilityID, FacReceiptNo, FacReceiptDate, FACReceiptType, SPLocationID, SPTYPE, Status
        ) VALUES (
          :newReceiptId, :facilityId, :facReceiptNo, TO_DATE(:formattedDate, 'DD-MM-YYYY'), 'SP', :spLocationId, 'Y', 'I'
        )
      `;

      await db.execute(insertSql, {
        newReceiptId,
        facilityId: Number(facilityId),
        facReceiptNo,
        formattedDate,
        spLocationId: Number(spLocationId)
      });

      return res.json({
        success: true,
        message: 'Updated Successfully',
        data: {
          receiptId: String(newReceiptId),
          receiptNo: facReceiptNo,
          receiptDate,
          spLocationId: String(spLocationId)
        }
      });
    } else {
      // Update existing record
      const updateSql = `
        UPDATE tbFacilityReceipts
        SET FacReceiptDate = TO_DATE(:formattedDate, 'DD-MM-YYYY'),
            SPLocationID = :spLocationId
        WHERE FacReceiptID = :receiptId AND FacilityID = :facilityId
      `;

      await db.execute(updateSql, {
        formattedDate,
        spLocationId: Number(spLocationId),
        receiptId: Number(receiptId),
        facilityId: Number(facilityId)
      });

      return res.json({
        success: true,
        message: 'Updated Successfully',
        data: {
          receiptId: String(receiptId),
          receiptDate,
          spLocationId: String(spLocationId)
        }
      });
    }
  } catch (error) {
    console.error('Error updating header info:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 6. Search / Autocomplete Items (masitems)
 */
async function searchItems(req, res) {
  try {
    const { query } = req.query;
    let sql;
    let binds = {};

    if (!query || query.trim().length === 0) {
      sql = `
        SELECT 
          mi.itemid AS "itemId",
          mi.itemcode AS "itemCode",
          mi.itemname AS "itemName",
          mi.strength1 AS "strength",
          mi.unit AS "unit",
          NVL(mit.itemtypecode, 'Drug') AS "itemTypeName",
          NVL(mi.packingqty, 1) AS "multiple",
          NVL(mi.isedl2019, 'N') AS "edlType",
          mi.itemcode || ' - ' || mi.itemname || NVL2(mi.strength1, ' (' || mi.strength1 || ')', '') AS "label"
        FROM masitems mi
        LEFT JOIN masitemtypes mit ON mit.itemtypeid = mi.itemtypeid
        ORDER BY mi.itemcode
        FETCH FIRST 100 ROWS ONLY
      `;
    } else {
      const searchTerm = `%${query.trim().toLowerCase()}%`;
      sql = `
        SELECT 
          mi.itemid AS "itemId",
          mi.itemcode AS "itemCode",
          mi.itemname AS "itemName",
          mi.strength1 AS "strength",
          mi.unit AS "unit",
          NVL(mit.itemtypecode, 'Drug') AS "itemTypeName",
          NVL(mi.packingqty, 1) AS "multiple",
          NVL(mi.isedl2019, 'N') AS "edlType",
          mi.itemcode || ' - ' || mi.itemname || NVL2(mi.strength1, ' (' || mi.strength1 || ')', '') AS "label"
        FROM masitems mi
        LEFT JOIN masitemtypes mit ON mit.itemtypeid = mi.itemtypeid
        WHERE (LOWER(mi.itemcode) LIKE :searchTerm OR LOWER(mi.itemname) LIKE :searchTerm)
        ORDER BY mi.itemcode
        FETCH FIRST 100 ROWS ONLY
      `;
      binds.searchTerm = searchTerm;
    }

    const result = await db.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const formatted = (result.rows || []).map(r => ({
      itemId: String(r.itemId || r.ITEMID),
      itemCode: r.itemCode || r.ITEMCODE || '',
      itemName: r.itemName || r.ITEMNAME || '',
      strength: r.strength || r.STRENGTH || '',
      unit: r.unit || r.UNIT || 'Nos',
      itemTypeName: r.itemTypeName || r.ITEMTYPENAME || 'Drug',
      multiple: Number(r.multiple != null ? r.multiple : r.MULTIPLE || 1),
      edlType: r.edlType || r.EDLTYPE || '',
      label: r.label || r.LABEL || `${r.itemCode || r.ITEMCODE} - ${r.itemName || r.ITEMNAME}`
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Error searching items:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 7. Get Items and nested Batches for a Special Receipt
 */
async function getReceiptItems(req, res) {
  try {
    const facilityId = req.user?.facilityId;
    const { receiptId } = req.query;

    if (!receiptId || receiptId === '0') {
      return res.json({ success: true, data: [] });
    }

    // 1. Fetch Items
    const itemsSql = `
      SELECT 
        ri.FACRECEIPTITEMID AS "receiptItemId",
        ri.FACRECEIPTID AS "receiptId",
        ri.ITEMID AS "itemId",
        mi.ITEMCODE AS "itemCode",
        mi.ITEMNAME AS "itemName",
        mi.STRENGTH1 AS "strength",
        mi.UNIT AS "unit",
        NVL(mit.itemtypecode, 'Drug') AS "itemTypeName",
        NVL(mi.PACKINGQTY, 1) AS "multiple",
        NVL(mi.ISEDL2019, 'N') AS "edlType",
        NVL(ri.ABSRQTY, 0) AS "receiptAbsQty"
      FROM tbfacilityreceiptitems ri
      INNER JOIN masitems mi ON mi.itemid = ri.itemid
      LEFT JOIN masitemtypes mit ON mit.itemtypeid = mi.itemtypeid
      WHERE ri.facreceiptid = :receiptId
      ORDER BY ri.facreceiptitemid
    `;

    const itemsResult = await db.execute(itemsSql, { receiptId: Number(receiptId) }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const items = itemsResult.rows || [];

    // 2. Fetch all batches for these items
    const batchesSql = `
      SELECT 
        b.INWNO AS "inwNo",
        b.FACRECEIPTITEMID AS "receiptItemId",
        b.ITEMID AS "itemId",
        b.BATCHNO AS "batchNo",
        TO_CHAR(b.MFGDATE, 'MM/YYYY') AS "mfgDate",
        TO_CHAR(b.EXPDATE, 'MM/YYYY') AS "expDate",
        NVL(b.ABSRQTY, 0) AS "absRQty",
        NVL(b.SHORTQTY, 0) AS "shortQty",
        b.STOCKLOCATION AS "stockLocation",
        NVL(m.LOCATIONNO, 'Null') AS "stockLocationName"
      FROM tbFacilityReceiptBatches b
      INNER JOIN tbfacilityreceiptitems ri ON ri.facreceiptitemid = b.facreceiptitemid
      LEFT OUTER JOIN masracks m ON m.rackid = b.StockLocation AND m.warehouseid = :facilityId
      WHERE ri.facreceiptid = :receiptId
      ORDER BY b.EXPDATE, b.BATCHNO
    `;

    const batchesResult = await db.execute(batchesSql, {
      receiptId: Number(receiptId),
      facilityId: Number(facilityId)
    }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    const batchesByItem = {};
    (batchesResult.rows || []).forEach(b => {
      const rItemId = String(b.receiptItemId || b.RECEIPTITEMID);
      if (!batchesByItem[rItemId]) batchesByItem[rItemId] = [];
      batchesByItem[rItemId].push({
        inwNo: String(b.inwNo || b.INWNO),
        receiptItemId: rItemId,
        itemId: String(b.itemId || b.ITEMID),
        batchNo: b.batchNo || b.BATCHNO || '',
        mfgDate: b.mfgDate || b.MFGDATE || '',
        expDate: b.expDate || b.EXPDATE || '',
        absRQty: Number(b.absRQty != null ? b.absRQty : b.ABSRQTY || 0),
        shortQty: Number(b.shortQty != null ? b.shortQty : b.SHORTQTY || 0),
        stockLocation: b.stockLocation != null ? String(b.stockLocation || b.STOCKLOCATION) : '',
        stockLocationName: b.stockLocationName || b.STOCKLOCATIONNAME || 'Null'
      });
    });

    const formattedItems = items.map(it => {
      const rItemId = String(it.receiptItemId || it.RECEIPTITEMID);
      return {
        receiptItemId: rItemId,
        receiptId: String(it.receiptId || it.RECEIPTID),
        itemId: String(it.itemId || it.ITEMID),
        itemCode: it.itemCode || it.ITEMCODE,
        itemName: it.itemName || it.ITEMNAME,
        strength: it.strength || it.STRENGTH,
        unit: it.unit || it.UNIT,
        itemTypeName: it.itemTypeName || it.ITEMTYPENAME,
        multiple: Number(it.multiple != null ? it.multiple : it.MULTIPLE || 1),
        edlType: it.edlType || it.EDLTYPE,
        receiptAbsQty: Number(it.receiptAbsQty != null ? it.receiptAbsQty : it.ABSRQTY || 0),
        batches: batchesByItem[rItemId] || []
      };
    });

    res.json({ success: true, data: formattedItems });
  } catch (error) {
    console.error('Error fetching receipt items:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 8. Save or Update Item
 */
async function saveReceiptItem(req, res) {
  try {
    const { receiptId, receiptItemId, itemId, receiptAbsQty } = req.body;

    if (!receiptId || receiptId === '0') {
      return res.status(400).json({ success: false, message: 'Receipt ID is required' });
    }
    if (!itemId) {
      return res.status(400).json({ success: false, message: 'Please select an item.' });
    }

    const qty = parseInt(receiptAbsQty, 10);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid Receipt Quantity (> 0).' });
    }

    // Get item multiple
    const mulRes = await db.execute(
      'SELECT NVL(packingqty, 1) AS "multiple" FROM masitems WHERE itemid = :itemId',
      { itemId: Number(itemId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const multiple = mulRes.rows && mulRes.rows.length > 0 
      ? Number(mulRes.rows[0].MULTIPLE || mulRes.rows[0].multiple || 1) 
      : 1;

    if (qty % multiple !== 0) {
      return res.status(400).json({
        success: false,
        message: `Entered Quantity must be a multiple of ${multiple}`
      });
    }

    if (!receiptItemId || receiptItemId === '0') {
      // Generate next FACReceiptItemID
      const seqItemSql = `SELECT NVL(MAX(FACRECEIPTITEMID), 0) + 1 AS "NEWID" FROM tbfacilityreceiptitems`;
      const seqItemRes = await db.execute(seqItemSql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const newReceiptItemId = seqItemRes.rows && seqItemRes.rows.length > 0
        ? Number(seqItemRes.rows[0].NEWID || seqItemRes.rows[0].newId || 1)
        : 1;

      // Insert item
      const insertSql = `
        INSERT INTO tbfacilityreceiptitems (FACReceiptItemID, FACReceiptID, ItemID, AbsRQty)
        VALUES (:newReceiptItemId, :receiptId, :itemId, :qty)
      `;
      await db.execute(insertSql, {
        newReceiptItemId,
        receiptId: Number(receiptId),
        itemId: Number(itemId),
        qty
      });
      res.json({ success: true, message: 'Item saved successfully', receiptItemId: newReceiptItemId });
    } else {
      // Update item
      const updateSql = `
        UPDATE tbfacilityreceiptitems 
        SET ItemID = :itemId, AbsRQty = :qty
        WHERE FACReceiptItemID = :receiptItemId AND FACReceiptID = :receiptId
      `;
      await db.execute(updateSql, {
        itemId: Number(itemId),
        qty,
        receiptItemId: Number(receiptItemId),
        receiptId: Number(receiptId)
      });
      res.json({ success: true, message: 'Item updated successfully' });
    }
  } catch (error) {
    console.error('Error saving item:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 9. Delete Item
 */
async function deleteReceiptItem(req, res) {
  try {
    const { receiptItemId } = req.params;

    // Check if batches exist
    const checkSql = `
      SELECT COUNT(1) AS CNT 
      FROM tbFacilityReceiptBatches 
      WHERE FACReceiptItemID = :receiptItemId
    `;
    const checkRes = await db.execute(checkSql, { receiptItemId: Number(receiptItemId) }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const cnt = checkRes.rows && checkRes.rows.length > 0 
      ? Number(checkRes.rows[0].CNT || checkRes.rows[0].cnt || 0)
      : 0;

    if (cnt > 0) {
      return res.status(400).json({
        success: false,
        message: 'Please delete Batches first.'
      });
    }

    const deleteSql = `DELETE FROM tbfacilityreceiptitems WHERE FACReceiptItemID = :receiptItemId`;
    await db.execute(deleteSql, { receiptItemId: Number(receiptItemId) });

    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ success: false, message: 'Delete not allowed. References found.' });
  }
}

/**
 * 10. Save Batch
 */
async function saveBatch(req, res) {
  try {
    const facilityId = req.user?.facilityId;
    const {
      receiptItemId,
      itemId,
      batchNo,
      mfgDate,
      expDate,
      absRQty,
      shortQty = 0,
      stockLocation
    } = req.body;

    if (!facilityId) {
      return res.status(400).json({ success: false, message: 'Facility ID is required' });
    }
    if (!receiptItemId || !itemId) {
      return res.status(400).json({ success: false, message: 'Please select and save item first.' });
    }
    if (!batchNo || !batchNo.trim()) {
      return res.status(400).json({ success: false, message: 'Batch No is required.' });
    }
    if (!stockLocation) {
      return res.status(400).json({ success: false, message: 'Stock Location is required.' });
    }
    if (!mfgDate) {
      return res.status(400).json({ success: false, message: 'Mfg Date is required.' });
    }
    if (!expDate) {
      return res.status(400).json({ success: false, message: 'Exp Date is required.' });
    }

    // Check rack setup
    const rackSql = `SELECT COUNT(rackid) AS CNT FROM masracks WHERE warehouseid = :facilityId`;
    const rackRes = await db.execute(rackSql, { facilityId: Number(facilityId) }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rackCnt = rackRes.rows && rackRes.rows.length > 0 
      ? Number(rackRes.rows[0].CNT || rackRes.rows[0].cnt || 0)
      : 0;

    if (rackCnt === 0) {
      return res.status(400).json({
        success: false,
        message: 'कृपया Master मेनू में जाकर Storage Location में Rack/Almira/Freez etc की एंट्री करें ततपश्चात Opening Stock में Batch Save करें |'
      });
    }

    // Check duplicate batch in this receipt item
    const dupSql = `
      SELECT COUNT(1) AS CNT 
      FROM tbFacilityReceiptBatches 
      WHERE FACReceiptItemID = :receiptItemId AND LOWER(TRIM(BatchNo)) = LOWER(TRIM(:batchNo))
    `;
    const dupRes = await db.execute(dupSql, {
      receiptItemId: Number(receiptItemId),
      batchNo: batchNo.trim()
    }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const dupCnt = dupRes.rows && dupRes.rows.length > 0
      ? Number(dupRes.rows[0].CNT || dupRes.rows[0].cnt || 0)
      : 0;

    if (dupCnt > 0) {
      return res.status(400).json({
        success: false,
        message: `Batch No. "${batchNo.trim()}" already exists for this item.`
      });
    }

    // Validate dates
    if (isDateGreaterThanToday(mfgDate, false)) {
      return res.status(400).json({ success: false, message: 'Mfg date cannot be greater than today.' });
    }
    if (!isDateGreaterThanToday(expDate, true)) {
      return res.status(400).json({ success: false, message: 'Exp date should be greater than today date.' });
    }

    const formattedMfg = formatDateForDb(mfgDate, false);
    const formattedExp = formatDateForDb(expDate, true);

    const qty = parseInt(absRQty, 10);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Batch Quantity must be greater than 0.' });
    }

    // Check multiple
    const mulRes = await db.execute(
      'SELECT NVL(packingqty, 1) AS "multiple" FROM masitems WHERE itemid = :itemId',
      { itemId: Number(itemId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const multiple = mulRes.rows && mulRes.rows.length > 0 
      ? Number(mulRes.rows[0].MULTIPLE || mulRes.rows[0].multiple || 1) 
      : 1;

    if (qty % multiple !== 0) {
      return res.status(400).json({
        success: false,
        message: `Entered Quantity must be a multiple of ${multiple}`
      });
    }

    // Check batch balance against item receipt quantity
    const balSql = `
      SELECT 
        i.AbsRQty AS "itemQty",
        (i.AbsRQty - NVL(SUM(b.AbsRQty), 0)) AS "balanceQty"
      FROM tbfacilityreceiptitems i
      LEFT OUTER JOIN tbFacilityReceiptBatches b ON b.FACReceiptItemID = i.FACReceiptItemID
      WHERE i.FACReceiptItemID = :receiptItemId
      GROUP BY i.FACReceiptItemID, i.AbsRQty
    `;
    const balRes = await db.execute(balSql, { receiptItemId: Number(receiptItemId) }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (balRes.rows && balRes.rows.length > 0) {
      const balanceQty = Number(balRes.rows[0].balanceQty != null ? balRes.rows[0].balanceQty : balRes.rows[0].BALANCEQTY);
      if (qty > balanceQty) {
        return res.status(400).json({
          success: false,
          message: `Entered batch quantity (${qty}) exceeds the Item balance quantity (${balanceQty}).`
        });
      }
    }

    // Generate next INWNO
    const seqInwSql = `SELECT NVL(MAX(INWNO), 0) + 1 AS "NEWID" FROM tbFacilityReceiptBatches`;
    const seqInwRes = await db.execute(seqInwSql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const newInwNo = seqInwRes.rows && seqInwRes.rows.length > 0
      ? Number(seqInwRes.rows[0].NEWID || seqInwRes.rows[0].newId || 1)
      : 1;

    // Insert into tbFacilityReceiptBatches
    const insertBatchSql = `
      INSERT INTO tbFacilityReceiptBatches (
        INWNO, FACReceiptItemID, ItemID, BatchNo, StockLocation, MfgDate, ExpDate, AbsRQty, ShortQty, qastatus
      ) VALUES (
        :newInwNo, :receiptItemId, :itemId, :batchNo, :stockLocation, 
        TO_DATE(:formattedMfg, 'DD-MM-YYYY'), TO_DATE(:formattedExp, 'DD-MM-YYYY'), 
        :qty, :shortQty, '1'
      )
    `;

    await db.execute(insertBatchSql, {
      newInwNo,
      receiptItemId: Number(receiptItemId),
      itemId: Number(itemId),
      batchNo: batchNo.trim(),
      stockLocation: Number(stockLocation),
      formattedMfg,
      formattedExp,
      qty,
      shortQty: Number(shortQty || 0)
    });

    res.json({ success: true, message: 'Batch Added Successfully' });
  } catch (error) {
    console.error('Error saving batch:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 11. Update Batch (StockLocation)
 */
async function updateBatch(req, res) {
  try {
    const { inwNo } = req.params;
    const { stockLocation } = req.body;

    if (!inwNo) {
      return res.status(400).json({ success: false, message: 'Batch ID is required' });
    }
    if (!stockLocation) {
      return res.status(400).json({ success: false, message: 'Stock Location is required' });
    }

    const updateSql = `
      UPDATE tbFacilityReceiptBatches 
      SET StockLocation = :stockLocation 
      WHERE InwNo = :inwNo
    `;
    await db.execute(updateSql, {
      stockLocation: Number(stockLocation),
      inwNo: Number(inwNo)
    });

    res.json({ success: true, message: 'Batch Updated Successfully' });
  } catch (error) {
    console.error('Error updating batch:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 12. Delete Batch
 */
async function deleteBatch(req, res) {
  try {
    const { inwNo } = req.params;
    if (!inwNo) {
      return res.status(400).json({ success: false, message: 'Batch ID is required' });
    }

    const deleteSql = `DELETE FROM tbFacilityReceiptBatches WHERE InwNo = :inwNo`;
    await db.execute(deleteSql, { inwNo: Number(inwNo) });

    res.json({ success: true, message: 'Batch Deleted Successfully' });
  } catch (error) {
    console.error('Error deleting batch:', error);
    res.status(500).json({ success: false, message: 'Delete not allowed. References found.' });
  }
}

/**
 * 13. Save General Info
 */
async function saveGeneral(req, res) {
  try {
    const { receiptId, stkRegNo, stkRegDate, remarks } = req.body;

    if (!receiptId || receiptId === '0') {
      return res.status(400).json({ success: false, message: 'Receipt ID is required.' });
    }
    if (!stkRegNo || !stkRegNo.trim()) {
      return res.status(400).json({ success: false, message: 'Voucher Number is required.' });
    }
    if (!stkRegDate || !stkRegDate.trim()) {
      return res.status(400).json({ success: false, message: 'Voucher Date is required.' });
    }

    if (isDateGreaterThanToday(stkRegDate)) {
      return res.status(400).json({ success: false, message: 'Voucher Date cannot be greater than today.' });
    }

    const formattedDate = formatDateForDb(stkRegDate);
    const cleanRemarks = (remarks || '').trim();

    if (cleanRemarks.length > 500) {
      return res.status(400).json({ success: false, message: 'Remarks cannot exceed 500 characters.' });
    }

    const sql = `
      UPDATE tbFacilityReceipts
      SET Remarks = :remarks,
          StkRegNo = :stkRegNo,
          StkRegDate = TO_DATE(:formattedDate, 'DD-MM-YYYY')
      WHERE FacReceiptID = :receiptId
    `;

    await db.execute(sql, {
      remarks: cleanRemarks,
      stkRegNo: stkRegNo.trim(),
      formattedDate,
      receiptId: Number(receiptId)
    });

    res.json({ success: true, message: 'Saved successfully' });
  } catch (error) {
    console.error('Error saving general tab:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 14. Complete / Freeze Special Receipt (btnFreez_Click logic)
 */
async function freezeReceipt(req, res) {
  try {
    const { receiptId } = req.body;
    if (!receiptId || receiptId === '0') {
      return res.status(400).json({ success: false, message: 'Receipt ID is required.' });
    }

    // 1. Check if there are items
    const itemsCheckSql = `SELECT COUNT(1) AS CNT FROM tbfacilityreceiptitems WHERE FACreceiptid = :receiptId`;
    const itemsCheckRes = await db.execute(itemsCheckSql, { receiptId: Number(receiptId) }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const itemsCnt = itemsCheckRes.rows && itemsCheckRes.rows.length > 0 
      ? Number(itemsCheckRes.rows[0].CNT || itemsCheckRes.rows[0].cnt || 0) 
      : 0;

    if (itemsCnt === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please Enter Opening Quantity along with batches'
      });
    }

    // 2. Check all total qty vs sum of batch qty for each item
    const checkStockSql = `
      SELECT 
        NVL(i.absrqty, 0) AS "openingQty",
        SUM(NVL(bt.absrqty, 0)) AS "batchQty",
        i.itemid AS "itemId",
        mi.itemcode AS "itemCode"
      FROM tbfacilityreceipts r
      INNER JOIN tbfacilityreceiptitems i ON r.FACreceiptid = i.FACreceiptid
      LEFT OUTER JOIN tbFacilityReceiptBatches bt ON bt.FACreceiptitemid = i.FACreceiptitemid
      INNER JOIN masitems mi ON mi.itemid = i.itemid
      WHERE r.FACreceipttype = 'SP' AND r.SPtype = 'Y' AND r.FACreceiptid = :receiptId
      GROUP BY i.absrqty, i.itemid, mi.itemcode
      HAVING SUM(NVL(bt.absrqty, 0)) <> i.absrqty
    `;

    const checkStockRes = await db.execute(checkStockSql, { receiptId: Number(receiptId) }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (checkStockRes.rows && checkStockRes.rows.length > 0) {
      const drugCode = checkStockRes.rows[0].itemCode || checkStockRes.rows[0].ITEMCODE;
      return res.status(400).json({
        success: false,
        message: `Please Enter Remaining batch quantity of Drugcode ${drugCode}`
      });
    }

    // 3. Freeze receipt
    const freezeSql = `UPDATE tbfacilityreceipts SET Status = 'C' WHERE facreceiptid = :receiptId`;
    await db.execute(freezeSql, { receiptId: Number(receiptId) });

    res.json({ success: true, message: 'Freezed Successfully' });
  } catch (error) {
    console.error('Error freezing receipt:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getSpecialReceiptsList,
  getSpLocations,
  getStorageLocations,
  getHeaderInfo,
  updateHeaderInfo,
  searchItems,
  getReceiptItems,
  saveReceiptItem,
  deleteReceiptItem,
  saveBatch,
  updateBatch,
  deleteBatch,
  saveGeneral,
  freezeReceipt
};
