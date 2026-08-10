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

module.exports = {
  getShortExpiryReport,
  getHoldBatches
};
