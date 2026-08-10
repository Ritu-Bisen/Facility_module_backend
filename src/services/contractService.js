const contractModel = require('../models/contractModel');

async function getContracts(facilityId, finYear) {
  if (!facilityId) throw new Error('Facility ID is required');
  return await contractModel.getContracts(facilityId, finYear);
}

async function getTenders(facilityId) {
  if (!facilityId) throw new Error('Facility ID is required');
  return await contractModel.getTenders(facilityId);
}

async function getFinYears() {
  return await contractModel.getFinYears();
}

async function getTendersList(facilityId, finYearId) {
  if (!facilityId) throw new Error('Facility ID is required');
  if (!finYearId) throw new Error('Financial Year ID is required');
  if (!finYearId) throw new Error('Financial Year ID is required');
  return await contractModel.getTendersList(facilityId, finYearId);
}

async function getLocalItems(finYearId) {
  return await contractModel.getLocalItems(finYearId);
}

async function createTender(facilityId, data) {
  if (!facilityId) throw new Error('Facility ID is required');
  await contractModel.createTender(facilityId, data);
}

async function updateTender(tenderId, data) {
  if (!tenderId) throw new Error('Tender ID is required');
  await contractModel.updateTender(tenderId, data);
}

async function deleteTender(tenderId) {
  if (!tenderId) throw new Error('Tender ID is required');
  await contractModel.deleteTender(tenderId);
}

async function getContractById(facilityId, id) {
  if (!facilityId) throw new Error('Facility ID is required');
  if (!id) throw new Error('Contract ID is required');
  return await contractModel.getContractById(facilityId, id);
}

async function getContractsForSO(accyrsetid, lpsupplierid, psaid) {
  if (!accyrsetid || !lpsupplierid || !psaid) throw new Error('Missing required parameters');
  return await contractModel.getContractsForSO(accyrsetid, lpsupplierid, psaid);
}

async function createContract(facilityId, data) {
  if (!facilityId) throw new Error('Facility ID is required');
  return await contractModel.createContract(facilityId, data);
}

async function updateContract(contractId, facilityId, data) {
  if (!contractId || !facilityId) throw new Error('Contract ID and Facility ID are required');
  await contractModel.updateContract(contractId, facilityId, data);
}

async function getContractItems(contractId) {
  if (!contractId) throw new Error('Contract ID is required');
  return await contractModel.getContractItems(contractId);
}

async function addContractItem(contractId, data) {
  if (!contractId) throw new Error('Contract ID is required');
  if (!data.lpItemId || !data.unitPrice || !data.qty) throw new Error('Missing required item fields');
  await contractModel.addContractItem(contractId, data);
}

async function deleteContractItem(contractItemId) {
  if (!contractItemId) throw new Error('Contract Item ID is required');
  await contractModel.deleteContractItem(contractItemId);
}

async function completeContract(contractId, facilityId) {
  if (!contractId || !facilityId) throw new Error('Contract ID and Facility ID are required');
  await contractModel.completeContract(contractId, facilityId);
}

module.exports = {
  getContracts,
  getTenders,
  getFinYears,
  getTendersList,
  createTender,
  updateTender,
  deleteTender,
  getContractById,
  getContractsForSO,
  createContract,
  updateContract,
  completeContract,
  getContractItems,
  addContractItem,
  deleteContractItem,
  getLocalItems
};
