const itemModel = require('../models/itemModel');
const logger = require('../utils/logger');

async function getItemDetails(req, res) {
  try {
    const { itemId } = req.params;
    if (!itemId) {
      return res.status(400).json({ error: "itemId is required" });
    }
    
    const details = await itemModel.getItemDetails(itemId);
    
    if (!details) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    res.json(details);
  } catch (error) {
    logger.error('Error in getItemDetails controller: ' + error.message);
    res.status(500).json({ error: error.message });
  }
}

async function getDrugs(req, res) {
  try {
    const drugs = await itemModel.getDrugs();
    res.json(drugs);
  } catch (error) {
    logger.error('Error in getDrugs controller: ' + error.message);
    res.status(500).json({ error: error.message });
  }
}

async function getItemTypes(req, res) {
  try {
    const itemTypes = await itemModel.getItemTypes();
    res.json(itemTypes);
  } catch (error) {
    logger.error('Error in getItemTypes controller: ' + error.message);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getItemDetails,
  getDrugs,
  getItemTypes
};
