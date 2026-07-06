const facilityModel = require('../models/facilityModel');
const logger = require('../utils/logger');

async function getItems(req, res) {
  try {
    const { facilityId } = req.params;
    if (!facilityId) {
      return res.status(400).json({ error: "facilityId is required" });
    }
    const items = await facilityModel.getItems(facilityId);
    res.json(items);
  } catch (error) {
    logger.error('Error in getItems controller: ' + error.message);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getItems
};
