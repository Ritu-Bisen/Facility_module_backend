const returnToWarehouseModel = require('../models/returnToWarehouseModel');

async function getReturnToWarehouseList(facilityId, finYearId, statusId) {
  return await returnToWarehouseModel.getReturnToWarehouseList(facilityId, finYearId, statusId);
}

async function getWarehouses(facilityId) {
  return await returnToWarehouseModel.getWarehouses(facilityId);
}

async function generateIssueNo(facilityId) {
  return await returnToWarehouseModel.generateIssueNo(facilityId);
}

async function getIncompleteIssue(facilityId) {
  return await returnToWarehouseModel.getIncompleteIssue(facilityId);
}

async function getHeaderInfo(issueId, facilityId) {
  return await returnToWarehouseModel.getHeaderInfo(issueId, facilityId);
}

async function createIssueHeader(facilityId, warehouseId, issueNo, issueDate, requestDate, requestBy) {
  return await returnToWarehouseModel.createIssueHeader(facilityId, warehouseId, issueNo, issueDate, requestDate, requestBy);
}

async function updateIssueHeader(issueId, facilityId, warehouseId, issueNo, issueDate, requestDate, requestBy) {
  return await returnToWarehouseModel.updateIssueHeader(issueId, facilityId, warehouseId, issueNo, issueDate, requestDate, requestBy);
}

async function deleteIssueHeader(issueId, facilityId) {
  return await returnToWarehouseModel.deleteIssueHeader(issueId, facilityId);
}

async function getIssueItems(issueId, facilityId) {
  return await returnToWarehouseModel.getIssueItems(issueId, facilityId);
}

async function getFacilityStock(facilityId, itemId) {
  return await returnToWarehouseModel.getFacilityStock(facilityId, itemId);
}

async function getItemMultiple(itemId) {
  return await returnToWarehouseModel.getItemMultiple(itemId);
}

async function getBatchesForItem(facilityId, issueItemId, itemId) {
  return await returnToWarehouseModel.getBatchesForItem(facilityId, issueItemId, itemId);
}

async function addIssueItem(issueId, itemId, curStock, allotted, issueQty) {
  return await returnToWarehouseModel.addIssueItem(issueId, itemId, curStock, allotted, issueQty);
}

async function updateIssueItem(issueItemId, itemId, curStock, allotted, issueQty) {
  return await returnToWarehouseModel.updateIssueItem(issueItemId, itemId, curStock, allotted, issueQty);
}

async function deleteIssueItem(issueItemId) {
  return await returnToWarehouseModel.deleteIssueItem(issueItemId);
}

async function completeIssue(issueId, facilityId) {
  return await returnToWarehouseModel.completeIssue(issueId, facilityId);
}

module.exports = {
  getReturnToWarehouseList,
  getWarehouses,
  generateIssueNo,
  getIncompleteIssue,
  getHeaderInfo,
  createIssueHeader,
  updateIssueHeader,
  deleteIssueHeader,
  getIssueItems,
  getFacilityStock,
  getItemMultiple,
  getBatchesForItem,
  addIssueItem,
  updateIssueItem,
  deleteIssueItem,
  completeIssue
};

