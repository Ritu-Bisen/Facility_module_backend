const reportService = require('../services/reportService');
const logger = require('../utils/logger');

async function getShortExpiryReport(req, res, next) {
  try {
    const facilityId = req.user.facilityId;
    const { categoryId, itemId, monthFilter, isMonth } = req.query;
    
    const data = await reportService.getShortExpiryReport(
      facilityId, 
      categoryId, 
      itemId, 
      monthFilter, 
      isMonth
    );
    
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error in getShortExpiryReport: ' + error.message);
    next(error);
  }
}

async function getHoldBatches(req, res, next) {
  try {
    const facilityId = req.user.facilityId;
    const { itemTypeId } = req.query;
    
    const data = await reportService.getHoldBatchesReport(
      facilityId, 
      itemTypeId
    );
    
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error in getHoldBatches: ' + error.message);
    next(error);
  }
}

async function getCgmscDrugWiseDropdowns(req, res, next) {
  try {
    const facilityId = req.user?.facilityId || 22595;
    const data = await reportService.getCgmscDrugWiseDropdowns(facilityId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error in getCgmscDrugWiseDropdowns: ' + error.message);
    next(error);
  }
}

async function getItemsByCategory(req, res, next) {
  try {
    const { categoryId } = req.query;
    const data = await reportService.getItemsByCategory(categoryId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error in getItemsByCategory: ' + error.message);
    next(error);
  }
}

async function getCgmscReceiptDrugWise(req, res, next) {
  try {
    const facilityId = req.user?.facilityId || 22595;
    const { warehouseId, categoryId, itemId, targetFacilityId, fromDate, toDate, startDate, endDate } = req.query;
    const fDate = fromDate || startDate;
    const tDate = toDate || endDate;
    const data = await reportService.getCgmscReceiptDrugWise(facilityId, warehouseId, categoryId, itemId, targetFacilityId, fDate, tDate);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error in getCgmscReceiptDrugWise: ' + error.message);
    next(error);
  }
}

async function getCgmscReceiptBatchWise(req, res, next) {
  try {
    const facilityId = req.user?.facilityId || 22595;
    const { warehouseId, targetFacilityId, categoryId, itemId, fromDate, toDate, startDate, endDate } = req.query;
    const fDate = fromDate || startDate;
    const tDate = toDate || endDate;
    const data = await reportService.getCgmscReceiptBatchWise(facilityId, warehouseId, targetFacilityId, categoryId, itemId, fDate, tDate);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error in getCgmscReceiptBatchWise: ' + error.message);
    next(error);
  }
}

async function getDateWiseFacilityDropdowns(req, res, next) {
  try {
    const data = await reportService.getDateWiseFacilityDropdowns();
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error in getDateWiseFacilityDropdowns: ' + error.message);
    next(error);
  }
}

async function getDateWiseFacilityIssue(req, res, next) {
  try {
    const facilityId = req.user?.facilityId || 22595;
    const { finYearId, categoryId, fromDate, toDate, startDate, endDate } = req.query;
    const fDate = fromDate || startDate;
    const tDate = toDate || endDate;
    const data = await reportService.getDateWiseFacilityIssue(facilityId, finYearId, categoryId, fDate, tDate);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error in getDateWiseFacilityIssue: ' + error.message);
    next(error);
  }
}

module.exports = {
  getShortExpiryReport,
  getHoldBatches,
  getCgmscDrugWiseDropdowns,
  getItemsByCategory,
  getCgmscReceiptDrugWise,
  getCgmscReceiptBatchWise,
  getDateWiseFacilityDropdowns,
  getDateWiseFacilityIssue
};
