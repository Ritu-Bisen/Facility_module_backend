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
    const facilityId = req.user.facilityId;
    const data = await returnToWarehouseService.getWarehouses(facilityId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch warehouses' });
  }
};

const getHeader = async (req, res) => {
  try {
    const data = await returnToWarehouseService.getHeader(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Issue not found' });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching header:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch header' });
  }
};

const createHeader = async (req, res) => {
  try {
    const data = { ...req.body, facilityId: req.user.facilityId };
    const issueId = await returnToWarehouseService.createHeader(data);
    res.json({ success: true, issueId });
  } catch (error) {
    console.error('Error creating header:', error);
    res.status(500).json({ success: false, message: 'Failed to create header' });
  }
};

const updateHeader = async (req, res) => {
  try {
    await returnToWarehouseService.updateHeader(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating header:', error);
    res.status(500).json({ success: false, message: 'Failed to update header' });
  }
};

const getItems = async (req, res) => {
  try {
    const data = await returnToWarehouseService.getItems(req.params.id, req.user.facilityId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch items' });
  }
};

const addItem = async (req, res) => {
  try {
    const data = { ...req.body, issueId: req.params.id };
    const issueItemId = await returnToWarehouseService.addItem(data);
    res.json({ success: true, issueItemId });
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).json({ success: false, message: 'Failed to add item' });
  }
};

const updateItem = async (req, res) => {
  try {
    await returnToWarehouseService.updateItem(req.params.itemId, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ success: false, message: 'Failed to update item' });
  }
};

const deleteItem = async (req, res) => {
  try {
    await returnToWarehouseService.deleteItem(req.params.itemId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ success: false, message: 'Failed to delete item' });
  }
};

const completeIssue = async (req, res) => {
  try {
    await returnToWarehouseService.completeIssue(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error completing issue:', error);
    res.status(500).json({ success: false, message: 'Failed to complete issue' });
  }
};

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
