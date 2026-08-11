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

module.exports = {
  getReturnToWarehouseList
};
