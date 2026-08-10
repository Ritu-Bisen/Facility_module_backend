const localPurchaseModel = require('../models/localPurchaseModel');

async function getBudgets() {
  return await localPurchaseModel.getBudgets();
}

async function getBudgetDetails(facilityId, budgetId) {
  if (!facilityId) {
    throw new Error('Facility ID is required');
  }
  return await localPurchaseModel.getBudgetDetails(facilityId, budgetId);
}

async function addBudgetDetail(data, facilityId) {
  if (!facilityId) {
    throw new Error('Facility ID is required');
  }
  if (!data.lpBudgetId) {
    throw new Error('Budget Head is required');
  }
  if (!data.recvDate) {
    throw new Error('Received Date is required');
  }
  
  return await localPurchaseModel.addBudgetDetail(data, facilityId);
}

// Local Suppliers

async function getSuppliers(facilityId) {
  if (!facilityId) throw new Error('Facility ID is required');
  return await localPurchaseModel.getSuppliers(facilityId);
}

async function getSupplierById(supplierId) {
  return await localPurchaseModel.getSupplierById(supplierId);
}

async function createSupplier(data, facilityId) {
  if (!facilityId) throw new Error('Facility ID is required');
  if (!data.supplierName) throw new Error('Supplier Name is required');
  return await localPurchaseModel.createSupplier(data, facilityId);
}

async function updateSupplier(supplierId, data, facilityId) {
  if (!facilityId) throw new Error('Facility ID is required');
  if (!data.supplierName) throw new Error('Supplier Name is required');
  return await localPurchaseModel.updateSupplier(supplierId, data, facilityId);
}

async function deleteSupplier(supplierId) {
  return await localPurchaseModel.deleteSupplier(supplierId);
}

async function getSupplyOrders(facilityId, finYearId, status) {
  if (!facilityId) throw new Error('Facility ID is required');
  if (!finYearId) throw new Error('Financial Year ID is required');
  return await localPurchaseModel.getSupplyOrders(facilityId, finYearId, status);
}

async function getSupplyOrderDetails(poNoId) {
  return await localPurchaseModel.getSupplyOrderDetails(poNoId);
}

async function getSupplyOrderItems(poNoId) {
  return await localPurchaseModel.getSupplyOrderItems(poNoId);
}

async function addSupplyOrderItem(poNoId, itemData) {
  return await localPurchaseModel.addSupplyOrderItem(poNoId, itemData);
}

async function deleteSupplyOrderItem(orderItemId, poNoId) {
  return await localPurchaseModel.deleteSupplyOrderItem(orderItemId, poNoId);
}

async function generateSupplyOrderNo(facilityId, finYearId) {
  if (!facilityId) throw new Error('Facility ID is required');
  if (!finYearId) throw new Error('Financial Year ID is required');
  return await localPurchaseModel.generateSupplyOrderNo(facilityId, finYearId);
}

async function saveSupplyOrderHeader(facilityId, data) {
  if (!facilityId) throw new Error('Facility ID is required');
  if (!data.accYrSetId) throw new Error('Financial Year ID is required');
  if (!data.lpSupplierId) throw new Error('Supplier ID is required');
  
  return await localPurchaseModel.saveSupplyOrderHeader(facilityId, data);
}

async function getSupplierReceipts(finYearId, facilityId) {
  if (!finYearId) throw new Error('Financial Year ID is required');
  if (!facilityId) throw new Error('Facility ID is required');
  return await localPurchaseModel.getSupplierReceipts(finYearId, facilityId);
}

async function getReceiptHeaderData(mode, id, facilityId) {
  if (!facilityId) throw new Error('Facility ID is required');
  if (!mode || !id) throw new Error('Mode and ID are required');
  return await localPurchaseModel.getReceiptHeaderData(mode, id, facilityId);
}

async function saveReceiptHeader(facilityId, data) {
  if (!facilityId) throw new Error('Facility ID is required');
  if (!data.receiptNo) throw new Error('Receipt No is required');
  if (!data.receiptDate) throw new Error('Receipt Date is required');
  return await localPurchaseModel.saveReceiptHeader(facilityId, data);
}

async function getReceiptItems(receiptId, poNoId, facilityId) {
  if (!facilityId) throw new Error('Facility ID is required');
  return await localPurchaseModel.getReceiptItems(receiptId, poNoId, facilityId);
}

async function saveReceiptItems(receiptId, items) {
  if (!receiptId) throw new Error('Receipt ID is required');
  if (!Array.isArray(items)) throw new Error('Items must be an array');
  return await localPurchaseModel.saveReceiptItems(receiptId, items);
}

async function getReceiptBatches(receiptId) {
  if (!receiptId) throw new Error('Receipt ID is required');
  return await localPurchaseModel.getReceiptBatches(receiptId);
}

async function saveReceiptBatch(batchData) {
  if (!batchData.receiptItemId) throw new Error('Receipt Item ID is required');
  if (!batchData.batchNo) throw new Error('Batch No is required');
  if (!batchData.mfgDate) throw new Error('Mfg Date is required');
  if (!batchData.expDate) throw new Error('Exp Date is required');
  if (!batchData.qty) throw new Error('Quantity is required');
  return await localPurchaseModel.saveReceiptBatch(batchData);
}

async function deleteReceiptBatch(inwNo) {
  if (!inwNo) throw new Error('Batch ID (InwNo) is required');
  return await localPurchaseModel.deleteReceiptBatch(inwNo);
}

async function completeReceipt(receiptId, facilityId) {
  if (!receiptId) throw new Error('Receipt ID is required');
  if (!facilityId) throw new Error('Facility ID is required');
  return await localPurchaseModel.completeReceipt(receiptId, facilityId);
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
