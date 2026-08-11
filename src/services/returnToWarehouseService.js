const returnToWarehouseModel = require('../models/returnToWarehouseModel');

async function getReturnToWarehouseList(facilityId, finYearId, statusId) {
  return await returnToWarehouseModel.getReturnToWarehouseList(facilityId, finYearId, statusId);
}

module.exports = {
  getReturnToWarehouseList
};
