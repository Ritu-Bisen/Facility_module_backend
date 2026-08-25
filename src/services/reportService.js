const reportModel = require('../models/reportModel');

async function getShortExpiryReport(facilityId, categoryId, itemId, monthFilter, isMonth) {
  const data = await reportModel.getShortExpiryReport(
    facilityId, 
    categoryId || '0', 
    itemId || '0', 
    monthFilter || '0 - 3', 
    isMonth === 'true' || isMonth === true
  );
  
  return data;
}

async function getHoldBatchesReport(facilityId, itemTypeId) {
  const data = await reportModel.getHoldBatchesReport(
    facilityId, 
    itemTypeId || '0'
  );
  
  return data;
}

async function getCgmscDrugWiseDropdowns(facilityId) {
  return await reportModel.getCgmscDrugWiseDropdowns(facilityId);
}

async function getItemsByCategory(categoryId) {
  return await reportModel.getItemsByCategory(categoryId);
}

async function getCgmscReceiptDrugWise(facilityId, warehouseId, categoryId, itemId, targetFacilityId, fromDate, toDate) {
  return await reportModel.getCgmscReceiptDrugWise(facilityId, warehouseId, categoryId, itemId, targetFacilityId, fromDate, toDate);
}

async function getCgmscReceiptBatchWise(facilityId, warehouseId, targetFacilityId, categoryId, itemId, fromDate, toDate) {
  return await reportModel.getCgmscReceiptBatchWise(facilityId, warehouseId, targetFacilityId, categoryId, itemId, fromDate, toDate);
}

async function getDateWiseFacilityDropdowns() {
  return await reportModel.getDateWiseFacilityDropdowns();
}

async function getDateWiseFacilityIssue(facilityId, finYearId, categoryId, fromDate, toDate) {
  return await reportModel.getDateWiseFacilityIssue(facilityId, finYearId, categoryId, fromDate, toDate);
}

module.exports = {
  getShortExpiryReport,
  getHoldBatchesReport,
  getCgmscDrugWiseDropdowns,
  getItemsByCategory,
  getCgmscReceiptDrugWise,
  getCgmscReceiptBatchWise,
  getDateWiseFacilityDropdowns,
  getDateWiseFacilityIssue
};
