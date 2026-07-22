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

module.exports = {
  getShortExpiryReport
};
