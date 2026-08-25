const db = require('../config/db');
const logger = require('../utils/logger');
const localPurchaseService = require('../services/localPurchaseService');
const contractModel = require('../models/contractModel');
const oracledb = require('oracledb');

// GET /api/ayush-local-purchase
async function getAyushOrders(req, res, next) {
  try {
    const facilityId = req.user.facilityId;
    const { finYearId, status } = req.query;

    if (!finYearId) {
      return res.status(400).json({ success: false, message: 'Financial Year ID is required' });
    }

    let query = `
      SELECT 
        a.PoNoID as "id", 
        a.PoNo as "poNo", 
        TO_CHAR(a.PoDate, 'DD-MM-YYYY') as "date", 
        a.LPSupplierID as "supplierId",
        sup.SupplierName as "supplierName",
        a.status as "status",
        a.SOValue as "soValue"
      FROM LPsoOrderPlaced a 
      INNER JOIN LPmasSuppliers sup ON sup.LPSupplierID = a.LPSupplierID
      WHERE a.PSAID = :facilityId 
        AND a.AccYrSetID = :finYearId 
        AND a.Sup_SOCode = 'AY'
    `;

    const binds = {
      facilityId: parseInt(facilityId, 10),
      finYearId: parseInt(finYearId, 10)
    };

    if (status && status !== 'All') {
      if (status === 'Incomplete') {
        query += ` AND a.status = 'IN'`;
      } else if (status === 'Order Placed') {
        query += ` AND a.status = 'O'`;
      }
    }

    query += ` ORDER BY a.PoNoID DESC`;

    const result = await db.execute(query, binds, { outFormat: 4002 });
    
    const formattedData = result.rows.map(r => ({
      id: r.id || r.ID,
      poNo: r.poNo || r.PONO,
      date: r.date || r.PODATE,
      supplierId: r.supplierId || r.LPSUPPLIERID,
      supplierName: r.supplierName || r.SUPPLIERNAME,
      status: (r.status === 'IN' || r.STATUS === 'IN') ? 'Incomplete' : 'Order Placed',
      totalAmount: r.soValue || r.SOVALUE || 0
    }));

    res.json({ success: true, data: formattedData });
  } catch (error) {
    logger.error('Error in getAyushOrders: ' + error.message);
    next(error);
  }
}

// GET /api/ayush-local-purchase/auto-number
async function generateAyushPoNo(req, res, next) {
  try {
    const facilityId = req.user.facilityId;
    const { finYearId } = req.query;

    if (!finYearId) {
      return res.status(400).json({ success: false, message: 'Financial Year ID is required' });
    }

    // Get year code
    const yrSql = `SELECT shaccyear FROM masaccyearsettings WHERE accyrsetid = :finYearId`;
    const yrRes = await db.execute(yrSql, { finYearId }, { outFormat: 4002 });
    const yearCode = yrRes.rows.length > 0 ? yrRes.rows[0].SHACCYEAR || yrRes.rows[0].shaccyear : '26-27';

    // Get facility code
    const psaSql = `SELECT facilityid as psacode FROM usrusers WHERE facilityid = :facilityId`;
    const psaRes = await db.execute(psaSql, { facilityId }, { outFormat: 4002 });
    const psaCode = psaRes.rows.length > 0 ? psaRes.rows[0].PSACODE || psaRes.rows[0].psacode : facilityId;

    // Get next sequence
    const seqSql = `SELECT NVL(MAX(TO_NUMBER(Auto_SOCode)), 0) + 1 as NEXT_SEQ FROM LPsoOrderPlaced WHERE PSAID = :facilityId AND AccYrSetID = :finYearId AND Auto_SOCode IS NOT NULL`;
    let nextSeqStr = '00001';
    try {
      const seqRes = await db.execute(seqSql, { facilityId, finYearId }, { outFormat: 4002 });
      if (seqRes.rows.length > 0) {
        const seq = seqRes.rows[0].NEXT_SEQ || seqRes.rows[0].next_seq;
        nextSeqStr = String(seq).padStart(5, '0');
      }
    } catch (err) {
      // fallback
    }

    // Generated PO number with formatted code
    const generatedNo = `${psaCode}/LP${nextSeqStr}/${yearCode}`;

    res.json({
      success: true,
      poNo: generatedNo,
      psaCode: psaCode,
      supplierCode: 'AY',
      autoSoCode: nextSeqStr,
      yearCode: yearCode
    });
  } catch (error) {
    logger.error('Error in generateAyushPoNo: ' + error.message);
    next(error);
  }
}

// POST /api/ayush-local-purchase
async function saveAyushHeader(req, res, next) {
  try {
    const facilityId = parseInt(req.user.facilityId, 10);
    const { id, supplierId, date, poNo, finYearId, contractNo, tenderNo, contractDate, fundId } = req.body;

    if (!supplierId || !date || !poNo || !finYearId || !contractNo || !tenderNo || !contractDate || !fundId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (id) {
      // Edit mode: Update existing Contract and Supply Order
      // 1. Get contractId from supply order
      const getSO = `SELECT ContractID FROM LPsoOrderPlaced WHERE PoNoID = :id AND PSAID = :facilityId`;
      const soRes = await db.execute(getSO, { id: parseInt(id, 10), facilityId }, { outFormat: 4002 });
      if (soRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Supply order not found' });
      }
      
      const contractId = soRes.rows[0].CONTRACTID || soRes.rows[0].contractid;

      // 2. Update Contract
      if (contractId) {
        const updateConSql = `
          UPDATE LPContracts SET 
            AccYrSetID = :finYearId,
            ContractNO = :contractNo,
            SchemeID = :tenderNo,
            ContractDate = TO_DATE(:contractDate, 'YYYY-MM-DD'),
            LPSupplierID = :supplierId,
            Status = 'C'
          WHERE ContractID = :contractId AND PSAID = :facilityId
        `;
        await db.execute(updateConSql, {
          finYearId: parseInt(finYearId, 10),
          contractNo,
          tenderNo: parseInt(tenderNo, 10),
          contractDate,
          supplierId: parseInt(supplierId, 10),
          contractId: parseInt(contractId, 10),
          facilityId
        }, { autoCommit: true });
      }

      // 3. Update Supply Order
      const updateSOSql = `
        UPDATE LPsoOrderPlaced SET 
          AccYrSetID = :finYearId,
          LPSupplierID = :supplierId,
          PONO = :poNo,
          PODate = TO_DATE(:poDate, 'YYYY-MM-DD'),
          CategoryID = :fundId
        WHERE PoNoID = :id AND PSAID = :facilityId
      `;
      await db.execute(updateSOSql, {
        finYearId: parseInt(finYearId, 10),
        supplierId: parseInt(supplierId, 10),
        poNo,
        poDate: date,
        fundId: parseInt(fundId, 10),
        id: parseInt(id, 10),
        facilityId
      }, { autoCommit: true });

      return res.json({ success: true, message: 'Header updated successfully', poNoId: id });
    } else {
      // Create mode
      // Prevent duplicate PO No
      const checkPOSql = `SELECT PoNoID FROM LPsoOrderPlaced WHERE PoNo = :poNo AND PSAID = :facilityId`;
      const checkPORes = await db.execute(checkPOSql, { poNo, facilityId }, { outFormat: 4002 });
      if (checkPORes.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'PO Number already exists' });
      }

      // 1. Insert contract into LPContracts
      const conInsertSql = `
        INSERT INTO LPContracts (
          AccYrSetID, SourceID, SchemeID, ContractNO, ContractDate, PSAID, LPSupplierID, Status, IsDirectContract
        ) VALUES (
          :finYearId, null, :tenderNo, :contractNo, TO_DATE(:contractDate, 'YYYY-MM-DD'), :facilityId, :supplierId, 'C', 1
        )
      `;
      await db.execute(conInsertSql, {
        finYearId: parseInt(finYearId, 10),
        contractNo,
        tenderNo: parseInt(tenderNo, 10),
        contractDate,
        facilityId,
        supplierId: parseInt(supplierId, 10)
      }, { autoCommit: true });

      // Retrieve generated ContractID
      const getConSql = `
        SELECT ContractID FROM LPContracts 
        WHERE ContractNO = :contractNo 
          AND PSAID = :facilityId
        ORDER BY ContractID DESC
      `;
      const getConRes = await db.execute(getConSql, { contractNo, facilityId }, { outFormat: 4002 });
      if (getConRes.rows.length === 0) {
        return res.status(500).json({ success: false, message: 'Failed to create associated contract' });
      }
      const contractId = getConRes.rows[0].CONTRACTID || getConRes.rows[0].contractid;

      // 2. Generate sequence fields for LPsoOrderPlaced (similar to saveSupplyOrderHeader)
      const yrSql = `SELECT shaccyear FROM masaccyearsettings WHERE accyrsetid = :finYearId`;
      const yrRes = await db.execute(yrSql, { finYearId }, { outFormat: 4002 });
      const yearCode = yrRes.rows.length > 0 ? yrRes.rows[0].SHACCYEAR || yrRes.rows[0].shaccyear : '26-27';

      const psaSql = `SELECT facilityid as psacode FROM usrusers WHERE facilityid = :facilityId`;
      const psaRes = await db.execute(psaSql, { facilityId }, { outFormat: 4002 });
      const psaCode = psaRes.rows.length > 0 ? psaRes.rows[0].PSACODE || psaRes.rows[0].psacode : facilityId;

      const seqSql = `SELECT NVL(MAX(TO_NUMBER(Auto_SOCode)), 0) + 1 as NEXT_SEQ FROM LPsoOrderPlaced WHERE PSAID = :facilityId AND AccYrSetID = :finYearId AND Auto_SOCode IS NOT NULL`;
      let nextSeqStr = '00001';
      try {
        const seqRes = await db.execute(seqSql, { facilityId, finYearId }, { outFormat: 4002 });
        if (seqRes.rows.length > 0) {
          const seq = seqRes.rows[0].NEXT_SEQ || seqRes.rows[0].next_seq;
          nextSeqStr = String(seq).padStart(5, '0');
        }
      } catch (err) {
        // fallback
      }

      // 3. Insert supply order into LPsoOrderPlaced
      const soInsertSql = `
        INSERT INTO LPsoOrderPlaced (
          contractid, AccYrSetID, SourceID, SchemeID, LPSupplierID, PONO, PODate, PSAID, CategoryID, PSA_SOCode, IC_SOCode, Sup_SOCode, Auto_SOCode, Status, ADVANCEREQUEST, ADVANCEPAID, ISLOCALPURCHASE, SENTMAIL
        ) VALUES (
          :contractId, :finYearId, 1, 1, :supplierId, :poNo, TO_DATE(:poDate, 'YYYY-MM-DD'), :facilityId, :fundId, :psaCode, '', 'AY', :autoSoCode, 'IN', 0, 0, 1, 0
        )
      `;
      await db.execute(soInsertSql, {
        contractId: parseInt(contractId, 10),
        finYearId: parseInt(finYearId, 10),
        supplierId: parseInt(supplierId, 10),
        poNo,
        poDate: date,
        facilityId,
        fundId: parseInt(fundId, 10),
        psaCode: psaCode.toString(),
        autoSoCode: nextSeqStr
      }, { autoCommit: true });

      // Retrieve generated PoNoID
      const getSOSql = `SELECT PoNoID FROM LPsoOrderPlaced WHERE PoNo = :poNo AND PSAID = :facilityId`;
      const getSORes = await db.execute(getSOSql, { poNo, facilityId }, { outFormat: 4002 });
      if (getSORes.rows.length === 0) {
        return res.status(500).json({ success: false, message: 'Failed to create supply order' });
      }
      const poNoId = getSORes.rows[0].PONOID || getSORes.rows[0].ponoid;

      return res.json({ success: true, message: 'Header saved successfully', poNoId });
    }
  } catch (error) {
    logger.error('Error in saveAyushHeader: ' + error.message);
    next(error);
  }
}

// GET /api/ayush-local-purchase/:id
async function getAyushOrderDetails(req, res, next) {
  try {
    const { id } = req.params;
    const facilityId = req.user.facilityId;

    const query = `
      SELECT 
        a.PoNoID as "id", 
        a.PoNo as "poNo", 
        TO_CHAR(a.PoDate, 'YYYY-MM-DD') as "date", 
        a.LPSupplierID as "supplierId",
        sup.SupplierName as "supplierName",
        a.status as "status",
        a.CategoryID as "categoryId",
        a.ContractID as "contractId",
        c.ContractNo as "contractNo",
        c.SchemeID as "tenderNo",
        TO_CHAR(c.ContractDate, 'YYYY-MM-DD') as "contractDate",
        a.AccYrSetID as "finYearId",
        a.DispatchNo as "dispatchNo",
        TO_CHAR(a.DispatchDate, 'YYYY-MM-DD') as "dispatchDate"
      FROM LPsoOrderPlaced a 
      INNER JOIN LPmasSuppliers sup ON sup.LPSupplierID = a.LPSupplierID
      LEFT JOIN LPContracts c ON c.ContractID = a.ContractID
      WHERE a.PoNoID = :id AND a.PSAID = :facilityId
    `;

    const result = await db.execute(query, { id: parseInt(id, 10), facilityId: parseInt(facilityId, 10) }, { outFormat: 4002 });
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const r = result.rows[0];
    const order = {
      id: r.id || r.ID,
      poNo: r.poNo || r.PONO,
      date: r.date || r.PODATE,
      supplierId: r.supplierId || r.LPSUPPLIERID,
      supplierName: r.supplierName || r.SUPPLIERNAME,
      status: (r.status === 'IN' || r.STATUS === 'IN') ? 'Incomplete' : 'Order Placed',
      categoryId: r.categoryId || r.CATEGORYID,
      contractId: r.contractId || r.CONTRACTID,
      contractNo: r.contractNo || r.CONTRACTNO,
      tenderNo: r.tenderNo || r.TENDERNO,
      contractDate: r.contractDate || r.CONTRACTDATE,
      finYearId: r.finYearId || r.ACCYRSETID,
      dispatchNo: r.dispatchNo || r.DISPATCHNO,
      dispatchDate: r.dispatchDate || r.DISPATCHDATE
    };

    // Fetch items
    const items = await localPurchaseService.getSupplyOrderItems(order.id);
    order.items = items || [];

    res.json({ success: true, data: order });
  } catch (error) {
    logger.error('Error in getAyushOrderDetails: ' + error.message);
    next(error);
  }
}

// DELETE /api/ayush-local-purchase/:id
async function deleteAyushOrder(req, res, next) {
  try {
    const { id } = req.params;
    const facilityId = req.user.facilityId;

    // 1. Find contractId first
    const getSO = `SELECT ContractID FROM LPsoOrderPlaced WHERE PoNoID = :id AND PSAID = :facilityId`;
    const soRes = await db.execute(getSO, { id: parseInt(id, 10), facilityId: parseInt(facilityId, 10) }, { outFormat: 4002 });
    if (soRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const contractId = soRes.rows[0].CONTRACTID || soRes.rows[0].contractid;

    // 2. Delete items
    const deleteItemsSql = `DELETE FROM LPsoOrderedItems WHERE PoNoID = :id`;
    await db.execute(deleteItemsSql, { id: parseInt(id, 10) }, { autoCommit: true });

    // 3. Delete supply order
    const deleteSOSql = `DELETE FROM LPsoOrderPlaced WHERE PoNoID = :id AND PSAID = :facilityId`;
    await db.execute(deleteSOSql, { id: parseInt(id, 10), facilityId: parseInt(facilityId, 10) }, { autoCommit: true });

    // 4. Delete contract items (if any) and contract
    if (contractId) {
      const deleteConItemsSql = `DELETE FROM LPContractItems WHERE ContractID = :contractId`;
      await db.execute(deleteConItemsSql, { contractId: parseInt(contractId, 10) }, { autoCommit: true });

      const deleteConSql = `DELETE FROM LPContracts WHERE ContractID = :contractId AND PSAID = :facilityId`;
      await db.execute(deleteConSql, { contractId: parseInt(contractId, 10), facilityId: parseInt(facilityId, 10) }, { autoCommit: true });
    }

    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    logger.error('Error in deleteAyushOrder: ' + error.message);
    next(error);
  }
}

// GET /api/ayush-local-purchase/:id/items
async function getAyushOrderItems(req, res, next) {
  try {
    const { id } = req.params;
    const items = await localPurchaseService.getSupplyOrderItems(id);
    res.json({ success: true, data: items || [] });
  } catch (error) {
    logger.error('Error in getAyushOrderItems: ' + error.message);
    next(error);
  }
}

// POST /api/ayush-local-purchase/:id/items
async function addAyushOrderItem(req, res, next) {
  try {
    const { id } = req.params;
    const { lpItemId, qty, basicRate, gst, unitPrice, totalAmount, nocDetail, manufacturer } = req.body;

    if (!lpItemId || qty === undefined || basicRate === undefined || gst === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required item fields' });
    }

    // Get item info from VMASITEMS
    const itemSql = `
      SELECT itemName, strength1 as strength, unit, categoryid
      FROM VMASITEMS
      WHERE ITEMID = :lpItemId
    `;
    const itemRes = await db.execute(itemSql, { lpItemId: parseInt(lpItemId, 10) }, { outFormat: 4002 });
    if (itemRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    const itemObj = itemRes.rows[0];

    // Find the contractid
    const poSql = `SELECT contractid FROM LPsoOrderPlaced WHERE PoNoID = :poNoId`;
    const poRes = await db.execute(poSql, { poNoId: parseInt(id, 10) }, { outFormat: 4002 });
    const contractId = poRes.rows.length > 0 ? (poRes.rows[0].CONTRACTID || poRes.rows[0].contractid) : null;

    let contractItemId = null;
    if (contractId) {
      const insertContractItemSql = `
        INSERT INTO LPContractItems (
          ContractID, LPItemID, SingleUnitPrice, ContractAbsQty, ItemValue, IsActive,
          Manufacturer, PercentValueGST, BasicRate
        ) VALUES (
          :contractId, :lpItemId, :unitPrice, :qty, :itemValue, 1,
          :manufacturer, :gst, :basicRate
        ) RETURNING CONTRACTITEMID INTO :insertedId
      `;
      const conVal = (parseFloat(unitPrice) * parseFloat(qty)).toFixed(2);
      const conRes = await db.execute(insertContractItemSql, {
        contractId: parseInt(contractId, 10),
        lpItemId: parseInt(lpItemId, 10),
        unitPrice: parseFloat(unitPrice),
        qty: parseFloat(qty),
        itemValue: parseFloat(conVal),
        manufacturer: manufacturer || null,
        gst: gst ? parseFloat(gst) : null,
        basicRate: basicRate ? parseFloat(basicRate) : null,
        insertedId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      }, { autoCommit: true });

      if (conRes.outBinds && conRes.outBinds.insertedId && conRes.outBinds.insertedId.length > 0) {
        contractItemId = conRes.outBinds.insertedId[0];
      }
    }

    const itemData = {
      lpItemId: parseInt(lpItemId, 10),
      itemName: itemObj.ITEMNAME || itemObj.itemname || '',
      orderQty: parseFloat(qty),
      unitPrice: parseFloat(unitPrice),
      amount: parseFloat(totalAmount),
      nocDetail: nocDetail || null,
      contractItemId: contractItemId
    };

    const result = await localPurchaseService.addSupplyOrderItem(id, itemData);
    
    res.json({ 
      success: true, 
      data: {
        orderItemId: result.orderItemId,
        lpItemId,
        itemName: itemData.itemName,
        strength: itemObj.STRENGTH || itemObj.strength || '',
        sku: itemObj.UNIT || itemObj.unit || '',
        qty,
        basicRate,
        gst,
        unitPrice,
        totalAmount,
        nocDetail,
        manufacturer,
        contractItemId
      }, 
      message: 'Item added successfully' 
    });
  } catch (error) {
    logger.error('Error in addAyushOrderItem: ' + error.message);
    next(error);
  }
}

// PUT /api/ayush-local-purchase/:id/items/:itemId
async function updateAyushOrderItem(req, res, next) {
  try {
    const { id, itemId } = req.params;
    const { lpItemId, qty, basicRate, gst, unitPrice, totalAmount, nocDetail } = req.body;

    const itemData = {
      lpItemId: lpItemId ? parseInt(lpItemId, 10) : null,
      orderQty: parseFloat(qty),
      unitPrice: parseFloat(unitPrice),
      amount: parseFloat(totalAmount),
      nocDetail: nocDetail || null
    };

    if (lpItemId) {
      const itemSql = `SELECT itemName FROM VMASITEMS WHERE ITEMID = :lpItemId`;
      const itemRes = await db.execute(itemSql, { lpItemId: parseInt(lpItemId, 10) }, { outFormat: 4002 });
      if (itemRes.rows.length > 0) {
        itemData.itemName = itemRes.rows[0].ITEMNAME || itemRes.rows[0].itemname || '';
      }
    }

    await localPurchaseService.updateSupplyOrderItem(itemId, id, itemData);
    res.json({ success: true, message: 'Item updated successfully' });
  } catch (error) {
    logger.error('Error in updateAyushOrderItem: ' + error.message);
    next(error);
  }
}

// DELETE /api/ayush-local-purchase/:id/items/:itemId
async function deleteAyushOrderItem(req, res, next) {
  try {
    const { id, itemId } = req.params;

    // 1. Get contractItemId from LPsoOrderedItems
    const selectSql = `SELECT CONTRACTITEMID FROM LPsoOrderedItems WHERE OrderItemID = :itemId`;
    const selectRes = await db.execute(selectSql, { itemId: parseInt(itemId, 10) }, { outFormat: 4002 });
    const contractItemId = selectRes.rows.length > 0 ? (selectRes.rows[0].CONTRACTITEMID || selectRes.rows[0].contractitemid) : null;

    // 2. Delete from LPsoOrderedItems
    await localPurchaseService.deleteSupplyOrderItem(itemId, id);

    // 3. Delete from LPContractItems
    if (contractItemId) {
      const deleteConItemSql = `DELETE FROM LPContractItems WHERE CONTRACTITEMID = :contractItemId`;
      await db.execute(deleteConItemSql, { contractItemId: parseInt(contractItemId, 10) }, { autoCommit: true });
    }

    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    logger.error('Error in deleteAyushOrderItem: ' + error.message);
    next(error);
  }
}

// PUT /api/ayush-local-purchase/:id/complete
async function completeAyushOrder(req, res, next) {
  try {
    const { id } = req.params;
    const { dispatchNo, dispatchDate } = req.body;
    const facilityId = req.user.facilityId;

    // 1. Get contractId
    const getSO = `SELECT ContractID FROM LPsoOrderPlaced WHERE PoNoID = :id AND PSAID = :facilityId`;
    const soRes = await db.execute(getSO, { id: parseInt(id, 10), facilityId: parseInt(facilityId, 10) }, { outFormat: 4002 });
    if (soRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const contractId = soRes.rows[0].CONTRACTID || soRes.rows[0].contractid;

    // 2. Complete supply order
    await localPurchaseService.completeSupplyOrder(id, dispatchNo, dispatchDate);

    // 3. Complete contract
    if (contractId) {
      await contractModel.completeContract(contractId, facilityId);
    }

    res.json({ success: true, message: 'PO completed successfully' });
  } catch (error) {
    logger.error('Error in completeAyushOrder: ' + error.message);
    next(error);
  }
}

// POST /api/ayush-local-purchase/:id/amend
async function amendAyushOrder(req, res, next) {
  try {
    const { id } = req.params;
    const facilityId = req.user.facilityId;

    // 1. Get contractId
    const getSO = `SELECT ContractID FROM LPsoOrderPlaced WHERE PoNoID = :id AND PSAID = :facilityId`;
    const soRes = await db.execute(getSO, { id: parseInt(id, 10), facilityId: parseInt(facilityId, 10) }, { outFormat: 4002 });
    if (soRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const contractId = soRes.rows[0].CONTRACTID || soRes.rows[0].contractid;

    // 2. Amend supply order
    await localPurchaseService.amendSupplyOrder(id);

    // 3. Amend contract
    if (contractId) {
      await contractModel.amendContract(contractId, facilityId);
    }

    res.json({ success: true, message: 'PO amended successfully' });
  } catch (error) {
    logger.error('Error in amendAyushOrder: ' + error.message);
    next(error);
  }
}

module.exports = {
  getAyushOrders,
  generateAyushPoNo,
  saveAyushHeader,
  getAyushOrderDetails,
  deleteAyushOrder,
  getAyushOrderItems,
  addAyushOrderItem,
  updateAyushOrderItem,
  deleteAyushOrderItem,
  completeAyushOrder,
  amendAyushOrder
};
