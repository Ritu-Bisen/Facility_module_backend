const contractService = require('../services/contractService');
const logger = require('../utils/logger');

async function getContracts(req, res, next) {
  try {
    const facilityId = req.user.facilityId;
    const { finYear } = req.query;
    const data = await contractService.getContracts(facilityId, finYear);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error in getContracts: ' + error.message);
    next(error);
  }
}

async function getTenders(req, res, next) {
  try {
    const facilityId = req.user.facilityId;
    const data = await contractService.getTenders(facilityId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error in getTenders: ' + error.message);
    next(error);
  }
}

async function getFinYears(req, res) {
  try {
    const data = await contractService.getFinYears();
    res.json(data);
  } catch (err) {
    console.error('Error fetching fin years:', err);
    res.status(500).json({ error: 'Failed to fetch financial years' });
  }
}

async function getTendersList(req, res) {
  try {
    const facilityId = req.user.facilityId;
    const { finYearId } = req.query;
    if (!finYearId) return res.status(400).json({ error: 'Fin Year ID is required' });
    
    const data = await contractService.getTendersList(facilityId, finYearId);
    res.json(data);
  } catch (err) {
    console.error('Error fetching tenders list:', err);
    res.status(500).json({ error: 'Failed to fetch tenders list' });
  }
}

async function getLocalItems(req, res) {
  try {
    const { finYearId } = req.query;
    const data = await contractService.getLocalItems(finYearId);
    res.json(data);
  } catch (err) {
    console.error('Error fetching local items:', err);
    res.status(500).json({ error: 'Failed to fetch local items' });
  }
}

async function createTender(req, res) {
  try {
    const facilityId = req.user.facilityId;
    await contractService.createTender(facilityId, req.body);
    res.json({ success: true, message: 'Tender created successfully' });
  } catch (err) {
    console.error('Error creating tender:', err);
    res.status(500).json({ error: 'Failed to create tender' });
  }
}

async function updateTender(req, res) {
  try {
    const { id } = req.params;
    await contractService.updateTender(id, req.body);
    res.json({ success: true, message: 'Tender updated successfully' });
  } catch (err) {
    console.error('Error updating tender:', err);
    res.status(500).json({ error: 'Failed to update tender' });
  }
}

async function deleteTender(req, res) {
  try {
    const { id } = req.params;
    await contractService.deleteTender(id);
    res.json({ success: true, message: 'Tender deleted successfully' });
  } catch (err) {
    console.error('Error deleting tender:', err);
    res.status(500).json({ error: 'Failed to delete tender' });
  }
}

async function getContractById(req, res) {
  try {
    const { id } = req.params;
    const facilityId = req.user.facilityId;
    const data = await contractService.getContractById(facilityId, id);
    if (!data) return res.status(404).json({ error: 'Contract not found' });
    res.json(data);
  } catch (err) {
    console.error('Error fetching contract by ID:', err);
    res.status(500).json({ error: 'Failed to fetch contract' });
  }
}

async function getContractsForSO(req, res) {
  try {
    const psaid = req.user.facilityId;
    const { accyrsetid, lpsupplierid } = req.query;
    
    if (!accyrsetid || !lpsupplierid) {
      return res.status(400).json({ error: 'accyrsetid and lpsupplierid are required' });
    }
    
    const data = await contractService.getContractsForSO(accyrsetid, lpsupplierid, psaid);
    res.json(data);
  } catch (err) {
    console.error('Error fetching contracts for SO:', err);
    res.status(500).json({ error: 'Failed to fetch contracts' });
  }
}

async function createContract(req, res) {
  try {
    const facilityId = req.user.facilityId;
    const contractId = await contractService.createContract(facilityId, req.body);
    res.json({ success: true, contractId, message: 'Contract created successfully' });
  } catch (err) {
    console.error('Error creating contract:', err);
    res.status(500).json({ error: 'Failed to create contract' });
  }
}

async function updateContract(req, res) {
  try {
    const { id } = req.params;
    const facilityId = req.user.facilityId;
    await contractService.updateContract(id, facilityId, req.body);
    res.json({ success: true, message: 'Contract updated successfully' });
  } catch (err) {
    console.error('Error updating contract:', err);
    res.status(500).json({ error: 'Failed to update contract' });
  }
}

async function getContractItems(req, res) {
  try {
    const { id } = req.params;
    const data = await contractService.getContractItems(id);
    res.json(data);
  } catch (err) {
    console.error('Error fetching contract items:', err);
    res.status(500).json({ error: 'Failed to fetch contract items' });
  }
}

async function addContractItem(req, res) {
  try {
    const { id } = req.params;
    await contractService.addContractItem(id, req.body);
    res.json({ success: true, message: 'Item added successfully' });
  } catch (err) {
    console.error('Error adding contract item:', err);
    res.status(500).json({ error: 'Failed to add contract item' });
  }
}

async function deleteContractItem(req, res) {
  try {
    const { itemId } = req.params;
    await contractService.deleteContractItem(itemId);
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (err) {
    console.error('Error deleting contract item:', err);
    res.status(500).json({ error: 'Failed to delete contract item' });
  }
}

async function completeContract(req, res) {
  try {
    const { id } = req.params;
    const facilityId = req.user.facilityId;
    await contractService.completeContract(id, facilityId);
    res.json({ success: true, message: 'Contract completed successfully' });
  } catch (err) {
    console.error('Error completing contract:', err);
    res.status(500).json({ error: 'Failed to complete contract' });
  }
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
