const db = require('../config/db');

/**
 * Get opening stock list for user's facility (FACreceipttype = 'FC')
 */
async function getOpeningStockList(req, res) {
  try {
    const facilityId = req.user?.facilityId;
    if (!facilityId) {
      return res.status(400).json({ success: false, message: 'Facility ID not found in session' });
    }

    const query = `
      SELECT 
        a.FACRECEIPTID AS "receiptId",
        a.FACRECEIPTNO AS "receiptNo",
        TO_CHAR(a.FACRECEIPTDATE, 'DD-MM-YYYY') AS "receiptDate",
        b.FACILITYNAME AS "facilityName",
        a.STATUS AS "status"
      FROM tbfacilityreceipts a
      JOIN masfacilities b ON a.facilityid = b.facilityid
      WHERE a.facilityid IS NOT NULL 
        AND a.FACRECEIPTTYPE = 'FC'
        AND a.facilityid = :facilityId
      ORDER BY a.FACRECEIPTDATE DESC, a.FACRECEIPTID DESC
    `;

    const result = await db.execute(query, { facilityId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    const rows = result.rows || [];

    const formattedRows = rows.map((row, index) => ({
      slNo: index + 1,
      receiptId: row.receiptId || row.RECEIPTID || row.FACRECEIPTID,
      receiptNo: row.receiptNo || row.RECEIPTNO || row.FACRECEIPTNO || '',
      receiptDate: row.receiptDate || row.RECEIPTDATE || row.FACRECEIPTDATE || '',
      facilityName: row.facilityName || row.FACILITYNAME || '',
      status: row.status || row.STATUS || ''
    }));

    const canAdd = formattedRows.length === 0;

    res.json({
      success: true,
      data: formattedRows,
      canAdd
    });
  } catch (error) {
    console.error('Error fetching opening stock list:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
}

/**
 * Check if opening stock entry exists for user's facility
 */
async function checkOpeningStockExists(req, res) {
  try {
    const facilityId = req.user?.facilityId;
    if (!facilityId) {
      return res.json({ exists: false, canAdd: true });
    }

    const query = `
      SELECT a.FACRECEIPTID AS "receiptId"
      FROM tbfacilityreceipts a
      JOIN masfacilities b ON a.facilityid = b.facilityid
      WHERE a.facilityid IS NOT NULL 
        AND a.FACRECEIPTTYPE = 'FC'
        AND a.facilityid = :facilityId
    `;

    const result = await db.execute(query, { facilityId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    const exists = (result.rows || []).length > 0;

    res.json({
      success: true,
      exists,
      canAdd: !exists
    });
  } catch (error) {
    console.error('Error checking opening stock existence:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
}

/**
 * Get Categories Dropdown
 */
async function getCategories(req, res) {
  try {
    const query = `
      SELECT categoryid AS "categoryId", categoryname AS "categoryName" 
      FROM masitemcategories 
      ORDER BY categoryname
    `;
    let result;
    try {
      result = await db.execute(query, [], { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    } catch {
      // Fallback table name if masitemcategories differs
      const fallbackQuery = `SELECT categoryid AS "categoryId", categoryname AS "categoryName" FROM mascategories ORDER BY categoryname`;
      result = await db.execute(fallbackQuery, [], { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    }
    res.json({ success: true, data: result.rows || [] });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get Items by Category
 */
async function getItemsByCategory(req, res) {
  try {
    const { categoryId } = req.query;
    let query = `
      SELECT 
        mi.itemid AS "itemId", 
        mi.itemcode AS "itemCode",
        mi.itemname AS "itemName",
        mi.itemcode || ' - ' || mi.itemname || NVL2(mi.strength1, ' (' || mi.strength1 || ')', '') AS "itemFullName"
      FROM vmasitems mi
    `;
    const binds = {};
    if (categoryId && categoryId !== '0') {
      query += ` WHERE mi.categoryid = :categoryId`;
      binds.categoryId = categoryId;
    }
    query += ` ORDER BY mi.itemname`;

    const result = await db.execute(query, binds, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    res.json({ success: true, data: result.rows || [] });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get Facility Storage Locations
 */
async function getStorageLocations(req, res) {
  try {
    const facilityId = req.user?.facilityId;
    if (!facilityId) {
      return res.status(400).json({ success: false, message: 'Facility ID required' });
    }

    const query = `
      SELECT rackid AS "rackId", locationno AS "locationNo" 
      FROM masracks 
      WHERE facilityid = :facilityId 
      ORDER BY locationno
    `;
    const result = await db.execute(query, { facilityId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    res.json({ success: true, data: result.rows || [] });
  } catch (error) {
    console.error('Error fetching storage locations:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get or Create Opening Stock Header Info
 */
async function getHeaderInfo(req, res) {
  try {
    const facilityId = req.user?.facilityId;
    if (!facilityId) {
      return res.status(400).json({ success: false, message: 'Facility ID required' });
    }

    const { receiptId } = req.query;
    let query = `
      SELECT 
        a.FACRECEIPTID AS "receiptId",
        a.FACRECEIPTNO AS "receiptNo",
        TO_CHAR(a.FACRECEIPTDATE, 'DD-MM-YYYY') AS "receiptDate",
        b.FACILITYNAME AS "facilityName",
        a.STATUS AS "status"
      FROM tbfacilityreceipts a
      JOIN masfacilities b ON a.facilityid = b.facilityid
      WHERE a.FACRECEIPTTYPE = 'FC' AND a.facilityid = :facilityId
    `;
    const binds = { facilityId };

    if (receiptId) {
      query += ` AND a.FACRECEIPTID = :receiptId`;
      binds.receiptId = receiptId;
    }

    let result = await db.execute(query, binds, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    let rows = result.rows || [];

    if (rows.length === 0 && !receiptId) {
      // Auto-generate or get next ID header if create mode
      const seqSql = `SELECT NVL(MAX(FACRECEIPTID), 0) + 1 AS "NEWID" FROM tbfacilityreceipts`;
      const seqRes = await db.execute(seqSql, [], { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
      const newId = seqRes.rows[0]?.NEWID || 1;
      const receiptNo = `${facilityId}/FC/${String(newId).padStart(5, '0')}/23-24`;
      const defaultDate = '01-06-2023';

      const insertSql = `
        INSERT INTO tbfacilityreceipts (FACRECEIPTID, FACILITYID, FACRECEIPTNO, FACRECEIPTDATE, FACRECEIPTTYPE, STATUS)
        VALUES (:newId, :facilityId, :receiptNo, TO_DATE(:defaultDate, 'DD-MM-YYYY'), 'FC', 'I')
      `;
      await db.execute(insertSql, { newId, facilityId, receiptNo, defaultDate });

      result = await db.execute(query, { facilityId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
      rows = result.rows || [];
    }

    const row = rows[0] || {};
    res.json({
      success: true,
      data: {
        receiptId: row.receiptId || row.RECEIPTID || row.FACRECEIPTID || '0',
        receiptNo: row.receiptNo || row.RECEIPTNO || row.FACRECEIPTNO || 'Auto generated',
        receiptDate: row.receiptDate || row.RECEIPTDATE || row.FACRECEIPTDATE || '01-06-2023',
        facilityName: row.facilityName || row.FACILITYNAME || '',
        status: row.status || row.STATUS || 'I'
      }
    });
  } catch (error) {
    console.error('Error getting header info:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Update Header Info
 */
async function updateHeaderInfo(req, res) {
  try {
    const facilityId = req.user?.facilityId;
    const { receiptId, receiptNo, receiptDate } = req.body;

    if (!receiptId) {
      return res.status(400).json({ success: false, message: 'Receipt ID required' });
    }

    const query = `
      UPDATE tbfacilityreceipts 
      SET FACRECEIPTNO = :receiptNo, 
          FACRECEIPTDATE = TO_DATE(:receiptDate, 'DD-MM-YYYY')
      WHERE FACRECEIPTID = :receiptId AND FACILITYID = :facilityId
    `;
    await db.execute(query, { receiptNo, receiptDate, receiptId, facilityId });
    res.json({ success: true, message: 'Header updated successfully' });
  } catch (error) {
    console.error('Error updating header info:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get Batch Entries Grid Data
 */
async function getOpeningStockBatches(req, res) {
  try {
    const facilityId = req.user?.facilityId;
    const { itemId, receiptId } = req.query;

    if (!facilityId) {
      return res.status(400).json({ success: false, message: 'Facility ID required' });
    }

    let query = `
      SELECT 
        0 AS "slNo",
        bt.inwno AS "inwNo",
        NVL(i.absrqty, 0) AS "openingQty",
        TO_CHAR(r.FACRECEIPTDATE, 'DD/MM/YYYY') AS "receiptDate",
        r.facilityid AS "facilityId",
        i.itemid AS "itemId",
        mi.itemcode AS "itemCode",
        mi.unit AS "unit",
        mi.strength1 AS "strength",
        mi.itemname AS "itemName",
        bt.batchno AS "batchNo",
        TO_CHAR(bt.mfgdate, 'DD/MM/YYYY') AS "mfgDate",
        TO_CHAR(bt.expdate, 'DD/MM/YYYY') AS "expDate",
        bt.absrqty AS "batchQty",
        r.facreceiptid AS "receiptId",
        i.facreceiptitemid AS "receiptItemId"
      FROM tbfacilityreceipts r 
      INNER JOIN tbfacilityreceiptitems i ON r.facreceiptid = i.facreceiptid 
      INNER JOIN tbFacilityReceiptBatches bt ON bt.facreceiptitemid = i.facreceiptitemid 
      INNER JOIN vmasitems mi ON mi.itemid = i.itemid  
      WHERE r.FACRECEIPTTYPE = 'FC' AND r.facilityid = :facilityId
    `;
    const binds = { facilityId };

    if (receiptId) {
      query += ` AND r.FACRECEIPTID = :receiptId`;
      binds.receiptId = receiptId;
    }
    if (itemId && itemId !== '0') {
      query += ` AND mi.itemid = :itemId`;
      binds.itemId = itemId;
    }

    query += ` ORDER BY mi.itemid, bt.batchno`;

    const result = await db.execute(query, binds, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    const rows = (result.rows || []).map((row, index) => ({
      slNo: index + 1,
      inwNo: row.inwNo || row.INWNO,
      receiptId: row.receiptId || row.RECEIPTID,
      receiptItemId: row.receiptItemId || row.RECEIPTITEMID,
      itemId: row.itemId || row.ITEMID,
      itemCode: row.itemCode || row.ITEMCODE || '',
      itemName: row.itemName || row.ITEMNAME || '',
      strength: row.strength || row.STRENGTH || row.STRENGTH1 || '',
      unit: row.unit || row.UNIT || '',
      openingQty: row.openingQty || row.OPENINGQTY || 0,
      batchQty: row.batchQty || row.BATCHQTY || row.ABSRQTY || 0,
      batchNo: row.batchNo || row.BATCHNO || '',
      mfgDate: row.mfgDate || row.MFGDATE || '',
      expDate: row.expDate || row.EXPDATE || ''
    }));

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching opening stock batches:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Save Batch Record (btnSave_Click logic)
 */
async function saveOpeningStockBatch(req, res) {
  try {
    const facilityId = req.user?.facilityId;
    const { receiptId, itemId, batchNo, batchQty, mfgDate, expDate, locationId } = req.body;

    if (!facilityId) {
      return res.status(400).json({ success: false, message: 'Facility ID required' });
    }
    if (!itemId || itemId === '0') {
      return res.status(400).json({ success: false, message: 'Please select Item' });
    }
    if (!batchNo || !batchQty || !mfgDate || !expDate || !locationId || locationId === '0') {
      return res.status(400).json({ success: false, message: 'Some fields are blank or location not selected' });
    }

    // 1. Get or Ensure FACRECEIPTID
    let activeReceiptId = receiptId;
    if (!activeReceiptId || activeReceiptId === '0') {
      const getHeaderSql = `SELECT FACRECEIPTID FROM tbfacilityreceipts WHERE facilityid = :facilityId AND FACRECEIPTTYPE = 'FC'`;
      const headerRes = await db.execute(getHeaderSql, { facilityId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
      if (headerRes.rows && headerRes.rows.length > 0) {
        activeReceiptId = headerRes.rows[0].FACRECEIPTID || headerRes.rows[0].facreceiptid;
      } else {
        const seqSql = `SELECT NVL(MAX(FACRECEIPTID), 0) + 1 AS "NEWID" FROM tbfacilityreceipts`;
        const seqRes = await db.execute(seqSql, [], { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
        activeReceiptId = seqRes.rows[0]?.NEWID || 1;
        const receiptNo = `${facilityId}/FC/${String(activeReceiptId).padStart(5, '0')}/23-24`;

        const insertHeaderSql = `
          INSERT INTO tbfacilityreceipts (FACRECEIPTID, FACILITYID, FACRECEIPTNO, FACRECEIPTDATE, FACRECEIPTTYPE, STATUS)
          VALUES (:activeReceiptId, :facilityId, :receiptNo, SYSDATE, 'FC', 'I')
        `;
        await db.execute(insertHeaderSql, { activeReceiptId, facilityId, receiptNo });
      }
    }

    // 2. Get or Ensure FACRECEIPTITEMID
    let receiptItemId = '0';
    const getItemSql = `
      SELECT FACRECEIPTITEMID FROM tbfacilityreceiptitems 
      WHERE FACRECEIPTID = :activeReceiptId AND ITEMID = :itemId
    `;
    const itemRes = await db.execute(getItemSql, { activeReceiptId, itemId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    if (itemRes.rows && itemRes.rows.length > 0) {
      receiptItemId = itemRes.rows[0].FACRECEIPTITEMID || itemRes.rows[0].facreceiptitemid;
    } else {
      const seqItemSql = `SELECT NVL(MAX(FACRECEIPTITEMID), 0) + 1 AS "NEWID" FROM tbfacilityreceiptitems`;
      const seqItemRes = await db.execute(seqItemSql, [], { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
      receiptItemId = seqItemRes.rows[0]?.NEWID || 1;

      const insertItemSql = `
        INSERT INTO tbfacilityreceiptitems (FACRECEIPTITEMID, FACRECEIPTID, ITEMID, ABSRQTY) 
        VALUES (:receiptItemId, :activeReceiptId, :itemId, 0)
      `;
      await db.execute(insertItemSql, { receiptItemId, activeReceiptId, itemId });
    }

    // 3. Check Duplicate Batch No
    const dupSql = `
      SELECT * FROM tbFacilityReceiptBatches 
      WHERE ITEMID = :itemId AND BATCHNO = :batchNo AND FACRECEIPTITEMID = :receiptItemId
    `;
    const dupRes = await db.execute(dupSql, { itemId, batchNo, receiptItemId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    if (dupRes.rows && dupRes.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Batch No is duplicate for this item' });
    }

    // Format Date string if needed (MM/YYYY to 01/MM/YYYY or DD/MM/YYYY)
    let formattedMfg = mfgDate;
    if (formattedMfg.length <= 7 && formattedMfg.includes('/')) {
      formattedMfg = '01/' + formattedMfg;
    }
    let formattedExp = expDate;
    if (formattedExp.length <= 7 && formattedExp.includes('/')) {
      const parts = formattedExp.split('/');
      const month = parseInt(parts[0], 10);
      const year = parseInt(parts[1], 10);
      const lastDay = new Date(year, month, 0).getDate();
      formattedExp = `${lastDay}/${formattedExp}`;
    }

    // 4. Insert into tbFacilityReceiptBatches
    const seqInwSql = `SELECT NVL(MAX(INWNO), 0) + 1 AS "NEWID" FROM tbFacilityReceiptBatches`;
    const seqInwRes = await db.execute(seqInwSql, [], { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    const newInwNo = seqInwRes.rows[0]?.NEWID || 1;

    const insertBatchSql = `
      INSERT INTO tbFacilityReceiptBatches (
        INWNO, FACRECEIPTITEMID, ITEMID, BATCHNO, STOCKLOCATION, MFGDATE, EXPDATE, ABSRQTY, SHORTQTY, QASTATUS
      ) VALUES (
        :newInwNo, :receiptItemId, :itemId, :batchNo, :locationId, 
        TO_DATE(:formattedMfg, 'DD/MM/YYYY'), 
        TO_DATE(:formattedExp, 'DD/MM/YYYY'), 
        :batchQty, 0, '1'
      )
    `;
    await db.execute(insertBatchSql, {
      newInwNo, receiptItemId, itemId, batchNo, locationId, formattedMfg, formattedExp, batchQty: Number(batchQty)
    });

    // 5. Update tbfacilityreceiptitems quantity
    const updateItemQtySql = `
      UPDATE tbfacilityreceiptitems 
      SET ABSRQTY = ABSRQTY + :batchQty 
      WHERE FACRECEIPTITEMID = :receiptItemId
    `;
    await db.execute(updateItemQtySql, { batchQty: Number(batchQty), receiptItemId });

    res.json({ success: true, message: 'Added Successfully', receiptId: activeReceiptId });
  } catch (error) {
    console.error('Error saving opening stock batch:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Delete Batch Record (gvItems_RowDeleting logic)
 */
async function deleteOpeningStockBatch(req, res) {
  try {
    const { inwNo, receiptItemId } = req.params;

    if (!inwNo || !receiptItemId) {
      return res.status(400).json({ success: false, message: 'Batch ID & Item ID required' });
    }

    // 1. Get Batch Quantity
    const getBatchQtySql = `SELECT ABSRQTY FROM tbFacilityReceiptBatches WHERE INWNO = :inwNo AND FACRECEIPTITEMID = :receiptItemId`;
    const batchRes = await db.execute(getBatchQtySql, { inwNo, receiptItemId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    const batchQty = batchRes.rows[0]?.ABSRQTY || 0;

    // 2. Delete Batch
    const deleteBatchSql = `DELETE FROM tbFacilityReceiptBatches WHERE INWNO = :inwNo AND FACRECEIPTITEMID = :receiptItemId`;
    await db.execute(deleteBatchSql, { inwNo, receiptItemId });

    // 3. Update or Delete Item Record
    const getItemQtySql = `SELECT ABSRQTY FROM tbfacilityreceiptitems WHERE FACRECEIPTITEMID = :receiptItemId`;
    const itemRes = await db.execute(getItemQtySql, { receiptItemId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    const itemQty = itemRes.rows[0]?.ABSRQTY || 0;

    if (itemQty <= batchQty) {
      const deleteItemSql = `DELETE FROM tbfacilityreceiptitems WHERE FACRECEIPTITEMID = :receiptItemId`;
      await db.execute(deleteItemSql, { receiptItemId });
    } else {
      const updateItemSql = `UPDATE tbfacilityreceiptitems SET ABSRQTY = ABSRQTY - :batchQty WHERE FACRECEIPTITEMID = :receiptItemId`;
      await db.execute(updateItemSql, { batchQty, receiptItemId });
    }

    res.json({ success: true, message: 'Deleted Successfully' });
  } catch (error) {
    console.error('Error deleting batch record:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Freeze Opening Stock (btnFreez_Click logic)
 */
async function freezeOpeningStock(req, res) {
  try {
    const facilityId = req.user?.facilityId;
    const { receiptId } = req.body;

    if (!facilityId || !receiptId) {
      return res.status(400).json({ success: false, message: 'Facility ID and Receipt ID required' });
    }

    // 1. Check if facility receipt batches exist
    const checkBatchesSql = `
      SELECT * FROM tbfacilityreceipts r
      INNER JOIN tbfacilityreceiptitems ri ON ri.facreceiptid = r.facreceiptid
      INNER JOIN tbfacilityreceiptbatches rb ON rb.facreceiptitemid = ri.facreceiptitemid
      WHERE r.facreceiptid = :receiptId
    `;
    const checkRes = await db.execute(checkBatchesSql, { receiptId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    if (!checkRes.rows || checkRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All the entries must be done before complete freezing the opening stock.'
      });
    }

    // 2. Freeze Status: Update to 'C'
    const freezeSql = `UPDATE tbfacilityreceipts SET STATUS = 'C' WHERE FACRECEIPTID = :receiptId`;
    await db.execute(freezeSql, { receiptId });

    res.json({ success: true, message: 'Freezed Successfully' });
  } catch (error) {
    console.error('Error freezing opening stock:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getOpeningStockList,
  checkOpeningStockExists,
  getCategories,
  getItemsByCategory,
  getStorageLocations,
  getHeaderInfo,
  updateHeaderInfo,
  getOpeningStockBatches,
  saveOpeningStockBatch,
  deleteOpeningStockBatch,
  freezeOpeningStock
};
