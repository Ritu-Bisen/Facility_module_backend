const stockRegisterModel = require('../models/stockRegisterModel');

async function getStockRegister(req, res) {
  try {
    const { itemId, fromDate } = req.query;
    const facilityId = req.user?.facilityId || 23246; // fallback for safety if req.user is undefined in test

    if (!itemId) {
      return res.status(400).json({ error: 'Item ID is required' });
    }
    if (!fromDate) {
      return res.status(400).json({ error: 'From Date is required' });
    }

    const data = await stockRegisterModel.getStockRegister(facilityId, itemId, fromDate);
    res.json(data);
  } catch (error) {
    console.error('Error in getStockRegister:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function getFacilityItems(req, res) {
  try {
    const facilityId = req.user?.facilityId || 23246;
    const items = await stockRegisterModel.getFacilityItems(facilityId);
    res.json(items);
  } catch (error) {
    console.error('Error in getFacilityItems:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = {
  getStockRegister,
  getFacilityItems
};
