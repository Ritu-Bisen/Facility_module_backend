const nocCancellationModel = require('../models/nocCancellationModel');

async function getNocsForCancellation(facilityId) {
  return await nocCancellationModel.getNocsForCancellation(facilityId);
}

async function getNocItemsForCancellation(nocId) {
  return await nocCancellationModel.getNocItemsForCancellation(nocId);
}

async function cancelNocItems(srs, userId) {
  return await nocCancellationModel.cancelNocItems(srs, userId);
}

module.exports = {
  getNocsForCancellation,
  getNocItemsForCancellation,
  cancelNocItems
};
