const returnToWarehouseModel = require('../models/returnToWarehouseModel');
const issueService = require('./issueService');

async function getReturnToWarehouseList(facilityId, finYearId, statusId) {
  return await returnToWarehouseModel.getReturnToWarehouseList(facilityId, finYearId, statusId);
}

async function getWarehouses(facilityId) {
  return await returnToWarehouseModel.getWarehouses(facilityId);
}

async function getHeader(issueId) {
  return await returnToWarehouseModel.getHeader(issueId);
}

async function createHeader(data) {
  const { facilityId } = data;
  const issueNo = await issueService.generateIssueNumber(facilityId, 'RF');
  if (!issueNo) {
      throw new Error('Could not generate Issue No - Facility not found');
  }
  data.issueNo = issueNo;
  return await returnToWarehouseModel.createHeader(data);
}

async function updateHeader(issueId, data) {
  await returnToWarehouseModel.updateHeader(issueId, data);
}

async function getItems(issueId, facilityId) {
  return await returnToWarehouseModel.getItems(issueId, facilityId);
}

async function addItem(data) {
  return await returnToWarehouseModel.addItem(data);
}

async function updateItem(issueItemId, data) {
  await returnToWarehouseModel.updateItem(issueItemId, data);
}

async function deleteItem(issueItemId) {
  await returnToWarehouseModel.deleteItem(issueItemId);
}

async function completeIssue(issueId) {
  await returnToWarehouseModel.completeIssue(issueId);
}

module.exports = {
  getReturnToWarehouseList,
  getWarehouses,
  getHeader,
  createHeader,
  updateHeader,
  getItems,
  addItem,
  updateItem,
  deleteItem,
  completeIssue
};
