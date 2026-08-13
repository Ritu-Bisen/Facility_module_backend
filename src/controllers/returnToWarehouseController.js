const returnToWarehouseService = require('../services/returnToWarehouseService');

const getReturnToWarehouseList = async (req, res) => {
  try {
    const facilityId = req.user.facilityId;
    const { finYearId, statusId } = req.query;

    if (!finYearId) {
      return res.status(400).json({ success: false, message: 'Financial Year is required' });
    }

    const data = await returnToWarehouseService.getReturnToWarehouseList(
      facilityId,
      parseInt(finYearId),
      statusId || 'AI'
    );
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching return to warehouse list:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch data' });
  }
};

const getWarehouses = async (req, res) => {
  try {
    const facilityId = req.query.facilityId || req.user.facilityId;
    const data = await returnToWarehouseService.getWarehouses(facilityId);
    res.json(data);
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch warehouses' });
  }
};

const generateIssueNo = async (req, res) => {
  try {
    const facilityId = req.query.facilityId || req.user.facilityId;
    const issueNo = await returnToWarehouseService.generateIssueNo(facilityId);
    res.json({ success: true, issueNo });
  } catch (error) {
    console.error('Error generating issue number:', error);
    res.status(500).json({ success: false, message: 'Failed to generate issue number' });
  }
};

const getIncompleteIssue = async (req, res) => {
  try {
    const facilityId = req.user.facilityId;
    const data = await returnToWarehouseService.getIncompleteIssue(facilityId);
    res.json(data);
  } catch (error) {
    console.error('Error fetching incomplete issue:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch incomplete issue' });
  }
};

const getHeaderInfo = async (req, res) => {
  try {
    const { issueId } = req.params;
    const facilityId = req.user.facilityId;
    const data = await returnToWarehouseService.getHeaderInfo(issueId, facilityId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching header info:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch header info' });
  }
};

const createIssueHeader = async (req, res) => {
  try {
    const facilityId = req.user.facilityId;
    const { warehouseId, issueNo, issueDate, requestDate, requestBy } = req.body;
    const issueId = await returnToWarehouseService.createIssueHeader(
      facilityId, warehouseId, issueNo, issueDate, requestDate || issueDate, requestBy
    );
    res.json({ success: true, issueId });
  } catch (error) {
    console.error('Error creating issue header:', error);
    res.status(500).json({ success: false, message: 'Failed to create issue header' });
  }
};

const updateIssueHeader = async (req, res) => {
  try {
    const { issueId } = req.params;
    const facilityId = req.user.facilityId;
    const { warehouseId, issueNo, issueDate, requestDate, requestBy } = req.body;
    await returnToWarehouseService.updateIssueHeader(
      issueId, facilityId, warehouseId, issueNo, issueDate, requestDate || issueDate, requestBy
    );
    res.json({ success: true, message: 'Header updated successfully' });
  } catch (error) {
    console.error('Error updating issue header:', error);
    res.status(500).json({ success: false, message: 'Failed to update issue header' });
  }
};

const deleteIssueHeader = async (req, res) => {
  try {
    const { issueId } = req.params;
    const facilityId = req.user.facilityId;
    await returnToWarehouseService.deleteIssueHeader(issueId, facilityId);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    console.error('Error deleting issue header:', error);
    res.status(500).json({ success: false, message: 'Failed to delete issue' });
  }
};

const getIssueItems = async (req, res) => {
  try {
    const { issueId } = req.params;
    if (!issueId || issueId === 'undefined' || issueId === 'null' || isNaN(parseInt(issueId))) {
      return res.json([]);
    }
    const facilityId = req.user.facilityId;
    const data = await returnToWarehouseService.getIssueItems(parseInt(issueId), facilityId);
    res.json(data);
  } catch (error) {
    console.error('Error fetching issue items:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch items' });
  }
};

const getFacilityStock = async (req, res) => {
  try {
    const facilityId = req.query.facilityId || req.user.facilityId;
    const itemId = req.query.itemId;
    const stock = await returnToWarehouseService.getFacilityStock(facilityId, itemId);
    res.json({ success: true, facilityStock: stock });
  } catch (error) {
    console.error('Error fetching facility stock:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stock' });
  }
};

const getItemMultiple = async (req, res) => {
  try {
    const { itemId } = req.params;
    const multiple = await returnToWarehouseService.getItemMultiple(itemId);
    res.json({ success: true, multiple });
  } catch (error) {
    console.error('Error fetching item multiple:', error);
    res.status(500).json({ success: false, multiple: 1 });
  }
};

const getBatchesForItem = async (req, res) => {
  try {
    const { issueItemId, itemId } = req.params;
    if (!issueItemId || issueItemId === 'undefined' || issueItemId === 'null' || isNaN(parseInt(issueItemId))) {
      return res.json({ success: true, data: [] });
    }
    const facilityId = req.user.facilityId;
    const data = await returnToWarehouseService.getBatchesForItem(facilityId, parseInt(issueItemId), itemId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching batch details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch batches' });
  }
};

const addIssueItem = async (req, res) => {
  try {
    const { issueId } = req.params;
    if (!issueId || issueId === 'undefined' || issueId === 'null' || isNaN(parseInt(issueId))) {
      return res.status(400).json({ success: false, error: 'Invalid Issue ID. Please save header first.' });
    }
    const { itemId, curStock, allotted, issueQty } = req.body;
    
    // Validate quantity multiple constraint
    const multiple = await returnToWarehouseService.getItemMultiple(itemId);
    if (multiple > 1 && (parseInt(issueQty) % multiple !== 0)) {
      return res.status(400).json({ success: false, error: `Quantity should be a multiple of ${multiple}` });
    }

    const issueItemId = await returnToWarehouseService.addIssueItem(parseInt(issueId), itemId, curStock || 0, allotted || 0, issueQty || 0);
    res.json({ success: true, issueItemId });
  } catch (error) {
    console.error('Error adding issue item:', error);
    res.status(500).json({ success: false, error: 'Failed to add item' });
  }
};

const updateIssueItem = async (req, res) => {
  try {
    const { issueItemId } = req.params;
    const { itemId, curStock, allotted, issueQty } = req.body;
    
    const multiple = await returnToWarehouseService.getItemMultiple(itemId);
    if (multiple > 1 && (parseInt(issueQty) % multiple !== 0)) {
      return res.status(400).json({ success: false, error: `Quantity should be a multiple of ${multiple}` });
    }

    await returnToWarehouseService.updateIssueItem(issueItemId, itemId, curStock || 0, allotted || 0, issueQty || 0);
    res.json({ success: true, message: 'Item updated successfully' });
  } catch (error) {
    console.error('Error updating issue item:', error);
    res.status(500).json({ success: false, error: 'Failed to update item' });
  }
};

const deleteIssueItem = async (req, res) => {
  try {
    const { issueItemId } = req.params;
    await returnToWarehouseService.deleteIssueItem(issueItemId);
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting issue item:', error);
    res.status(500).json({ success: false, error: 'Failed to delete item' });
  }
};

const completeIssue = async (req, res) => {
  try {
    const { issueId } = req.params;
    const facilityId = req.user.facilityId;
    await returnToWarehouseService.completeIssue(issueId, facilityId);
    res.json({ success: true, message: 'Issue status changed successfully' });
  } catch (error) {
    console.error('Error completing issue:', error);
    res.status(500).json({ success: false, error: 'Failed to complete issue' });
  }
};

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

