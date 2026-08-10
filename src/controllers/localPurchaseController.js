const localPurchaseService = require('../services/localPurchaseService');
const logger = require('../utils/logger');

async function getBudgets(req, res, next) {
  try {
    const data = await localPurchaseService.getBudgets();
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error in getBudgets: ' + error.message);
    next(error);
  }
}

async function getBudgetDetails(req, res, next) {
  try {
    const facilityId = req.user.facilityId;
    const { budgetId } = req.query;
    
    const data = await localPurchaseService.getBudgetDetails(facilityId, budgetId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error in getBudgetDetails: ' + error.message);
    next(error);
  }
}

async function addBudgetDetail(req, res, next) {
  try {
    const facilityId = req.user.facilityId;
    await localPurchaseService.addBudgetDetail(req.body, facilityId);
    res.json({ success: true, message: 'Fund detail added successfully' });
  } catch (error) {
    logger.error('Error in addBudgetDetail: ' + error.message);
    next(error);
  }
}

// Local Suppliers

async function getSuppliers(req, res, next) {
  try {
    const facilityId = req.user.facilityId;
    const data = await localPurchaseService.getSuppliers(facilityId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error in getSuppliers: ' + error.message);
    next(error);
  }
}

async function getSupplierById(req, res, next) {
  try {
    const data = await localPurchaseService.getSupplierById(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Supplier not found' });
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error in getSupplierById: ' + error.message);
    next(error);
  }
}

async function createSupplier(req, res, next) {
  try {
    const facilityId = req.user.facilityId;
    const supplierCode = await localPurchaseService.createSupplier(req.body, facilityId);
    res.json({ success: true, message: 'Supplier created successfully', supplierCode });
  } catch (error) {
    logger.error('Error in createSupplier: ' + error.message);
    next(error);
  }
}

async function updateSupplier(req, res, next) {
  try {
    const facilityId = req.user.facilityId;
    await localPurchaseService.updateSupplier(req.params.id, req.body, facilityId);
    res.json({ success: true, message: 'Supplier updated successfully' });
  } catch (error) {
    logger.error('Error in updateSupplier: ' + error.message);
    next(error);
  }
}

async function deleteSupplier(req, res, next) {
  try {
    await localPurchaseService.deleteSupplier(req.params.id);
    res.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error) {
    logger.error('Error in deleteSupplier: ' + error.message);
    next(error);
  }
}

async function getSupplyOrders(req, res, next) {
  try {
    const facilityId = req.user.facilityId;
    const { finYearId, status } = req.query;
    
    if (!finYearId) {
      return res.status(400).json({ success: false, message: 'Financial Year ID is required' });
    }
    
    const data = await localPurchaseService.getSupplyOrders(facilityId, finYearId, status);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error in getSupplyOrders: ' + error.message);
    next(error);
  }
}

const getSupplyOrderDetails = async (req, res) => {
  try {
    const { id, poNoId } = req.params;
    const poId = poNoId || id;
    const result = await localPurchaseService.getSupplyOrderDetails(poId);
    if (!result) return res.status(404).json({ success: false, message: 'Supply order not found' });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching supply order details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch supply order details' });
  }
};

const getSupplyOrderItems = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await localPurchaseService.getSupplyOrderItems(id);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching supply order items:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch supply order items' });
  }
};

const addSupplyOrderItem = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await localPurchaseService.addSupplyOrderItem(id, req.body);
    res.json({ success: true, data: result, message: 'Item added successfully' });
  } catch (error) {
    console.error('Error adding supply order item:', error);
    res.status(500).json({ success: false, message: 'Failed to add supply order item' });
  }
};

const deleteSupplyOrderItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    await localPurchaseService.deleteSupplyOrderItem(itemId, id);
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting supply order item:', error);
    res.status(500).json({ success: false, message: 'Failed to delete supply order item' });
  }
};

async function generateSupplyOrderNo(req, res) {
  try {
    const facilityId = req.user.facilityId;
    const { finYearId } = req.query;
    if (!finYearId) return res.status(400).json({ error: 'finYearId is required' });
    
    const data = await localPurchaseService.generateSupplyOrderNo(facilityId, finYearId);
    res.json(data);
  } catch (err) {
    console.error('Error generating supply order no:', err);
    res.status(500).json({ error: 'Failed to generate supply order no' });
  }
}

async function saveSupplyOrderHeader(req, res) {
  try {
    const facilityId = req.user.facilityId;
    const poNoId = await localPurchaseService.saveSupplyOrderHeader(facilityId, req.body);
    res.json({ success: true, message: 'Supply order header saved', poNoId });
  } catch (err) {
    console.error('Error saving supply order header:', err);
    res.status(500).json({ error: 'Failed to save supply order header' });
  }
}

async function getSupplierReceipts(req, res) {
  try {
    const facilityId = req.user.facilityId;
    const { finYearId } = req.query;
    if (!finYearId) return res.status(400).json({ error: 'finYearId is required' });

    const data = await localPurchaseService.getSupplierReceipts(finYearId, facilityId);
    res.json(data);
  } catch (err) {
    console.error('Error fetching supplier receipts:', err);
    res.status(500).json({ error: 'Failed to fetch supplier receipts' });
  }
}

async function getReceiptHeaderData(req, res) {
  try {
    const facilityId = req.user.facilityId;
    const { mode, id } = req.query; // mode=create/edit, id=poNoId/receiptId
    if (!mode || !id) return res.status(400).json({ error: 'mode and id are required' });
    
    const data = await localPurchaseService.getReceiptHeaderData(mode, id, facilityId);
    if (!data) return res.status(404).json({ error: 'Data not found' });
    res.json(data);
  } catch (err) {
    console.error('Error fetching receipt header data:', err);
    res.status(500).json({ error: 'Failed to fetch receipt header data' });
  }
}

async function saveReceiptHeader(req, res) {
  try {
    const facilityId = req.user.facilityId;
    const receiptId = await localPurchaseService.saveReceiptHeader(facilityId, req.body);
    res.json({ success: true, message: 'Receipt header saved', receiptId });
  } catch (err) {
    console.error('Error saving receipt header:', err);
    res.status(500).json({ error: 'Failed to save receipt header' });
  }
}

async function getReceiptItems(req, res) {
  try {
    const facilityId = req.user.facilityId;
    const { receiptId, poNoId } = req.query;
    if (!poNoId) return res.status(400).json({ error: 'poNoId is required' });

    const data = await localPurchaseService.getReceiptItems(receiptId, poNoId, facilityId);
    res.json(data);
  } catch (err) {
    console.error('Error fetching receipt items:', err);
    res.status(500).json({ error: 'Failed to fetch receipt items' });
  }
}

async function saveReceiptItems(req, res) {
  try {
    const { receiptId } = req.params;
    const items = req.body.items;
    if (!receiptId || !items) return res.status(400).json({ error: 'receiptId and items are required' });

    await localPurchaseService.saveReceiptItems(receiptId, items);
    res.json({ success: true, message: 'Receipt items saved' });
  } catch (err) {
    console.error('Error saving receipt items:', err);
    res.status(500).json({ error: 'Failed to save receipt items' });
  }
}

async function getReceiptBatches(req, res) {
  try {
    const { receiptId } = req.params;
    const data = await localPurchaseService.getReceiptBatches(receiptId);
    res.json(data);
  } catch (err) {
    console.error('Error fetching receipt batches:', err);
    res.status(500).json({ error: 'Failed to fetch receipt batches' });
  }
}

async function saveReceiptBatch(req, res) {
  try {
    const { receiptId } = req.params; // from url, though we may only need receiptItemId inside body
    await localPurchaseService.saveReceiptBatch(req.body);
    res.json({ success: true, message: 'Batch saved successfully' });
  } catch (err) {
    console.error('Error saving receipt batch:', err);
    res.status(500).json({ error: 'Failed to save receipt batch' });
  }
}

async function deleteReceiptBatch(req, res) {
  try {
    const { inwNo } = req.params;
    await localPurchaseService.deleteReceiptBatch(inwNo);
    res.json({ success: true, message: 'Batch deleted successfully' });
  } catch (err) {
    console.error('Error deleting receipt batch:', err);
    res.status(500).json({ error: 'Failed to delete receipt batch' });
  }
}

async function completeReceipt(req, res) {
  try {
    const facilityId = req.user.facilityId;
    const { receiptId } = req.params;
    const mrcNumber = await localPurchaseService.completeReceipt(receiptId, facilityId);
    res.json({ success: true, message: 'Receipt completed successfully', mrcNumber });
  } catch (err) {
    console.error('Error completing receipt:', err);
    res.status(500).json({ error: err.message || 'Failed to complete receipt' });
  }
}

module.exports = {
  getBudgets,
  getBudgetDetails,
  addBudgetDetail,
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplyOrders,
  getSupplyOrderDetails,
  getSupplyOrderItems,
  addSupplyOrderItem,
  deleteSupplyOrderItem,
  generateSupplyOrderNo,
  saveSupplyOrderHeader,
  getSupplierReceipts,
  getReceiptHeaderData,
  saveReceiptHeader,
  getReceiptItems,
  saveReceiptItems,
  getReceiptBatches,
  saveReceiptBatch,
  deleteReceiptBatch,
  completeReceipt
};
