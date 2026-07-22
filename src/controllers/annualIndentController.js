const annualIndentModel = require('../models/annualIndentModel');

async function getItems(req, res) {
  try {
    const facilityId = req.user?.facilityId || 23246; // fallback for safety
    const items = await annualIndentModel.getIndentItems(facilityId);
    res.json(items);
  } catch (error) {
    console.error('Error in getItems:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function getSummary(req, res) {
  try {
    const { itemId } = req.query;
    if (!itemId) return res.status(400).json({ error: 'Item ID is required' });
    
    const facilityId = req.user?.facilityId || 23246;
    const summary = await annualIndentModel.getIndentSummary(facilityId, itemId);
    res.json(summary);
  } catch (error) {
    console.error('Error in getSummary:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function getDistributions(req, res) {
  try {
    const { itemId } = req.query;
    if (!itemId) return res.status(400).json({ error: 'Item ID is required' });
    
    const facilityId = req.user?.facilityId || 23246;
    const distributions = await annualIndentModel.getFacilityDistributions(facilityId, itemId);
    res.json(distributions);
  } catch (error) {
    console.error('Error in getDistributions:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function updateDistribution(req, res) {
  try {
    const { issueItemId, targetFacilityId, itemId, itemCode, indentId, distQty } = req.body;
    
    // If issueItemId is 0 or "0", it's a new insert, else update
    if (!issueItemId || issueItemId == 0) {
      if (!indentId || !targetFacilityId || !itemId || !itemCode || !distQty) {
         return res.status(400).json({ error: 'Missing parameters for insertion' });
      }
      await annualIndentModel.insertDistribution(indentId, targetFacilityId, itemId, itemCode, distQty);
      res.json({ message: 'Inserted Successfully' });
    } else {
      if (!distQty) {
         return res.status(400).json({ error: 'Missing distQty for update' });
      }
      await annualIndentModel.updateDistribution(issueItemId, distQty);
      res.json({ message: 'Updated Successfully' });
    }
  } catch (error) {
    console.error('Error in updateDistribution:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function deleteDistribution(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'ID is required' });
    
    await annualIndentModel.deleteDistribution(id);
    res.json({ message: 'Deleted Successfully' });
  } catch (error) {
    console.error('Error in deleteDistribution:', error);
    // Mimic the C# error for constraints
    res.status(400).json({ error: 'Delete not allowed, references found' });
  }
}

module.exports = {
  getItems,
  getSummary,
  getDistributions,
  updateDistribution,
  deleteDistribution
};
