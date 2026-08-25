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

async function getMcHospitalAiVsIssuance(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 23393;
    const data = await annualIndentModel.getMcHospitalAiVsIssuance(facilityId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getMcHospitalAiVsIssuance:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getDownloadAiFormatData(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const data = await annualIndentModel.getDownloadAiFormatData(facilityId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getDownloadAiFormatData:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getUploadForwardFinYears(req, res) {
  try {
    const data = await annualIndentModel.getUploadForwardFinYears();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getUploadForwardFinYears:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getUploadForwardList(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const { finYearId } = req.query;
    const data = await annualIndentModel.getUploadForwardList(facilityId, finYearId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getUploadForwardList:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getCreateIndentHeader(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const { finYearId } = req.query;
    const data = await annualIndentModel.getCreateIndentHeader(facilityId, finYearId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getCreateIndentHeader:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getCreateIndentItems(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const { finYearId, indentId } = req.query;
    const data = await annualIndentModel.getCreateIndentItems(facilityId, finYearId, indentId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getCreateIndentItems:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function updateCreateIndentItem(req, res) {
  try {
    const { anualIndentId, consumption, actualConsumption, projectedConsumption, currentStock, facilityIndentQty, rate } = req.body;
    await annualIndentModel.updateCreateIndentItem(anualIndentId, consumption, actualConsumption, projectedConsumption, currentStock, facilityIndentQty, rate);
    res.json({ success: true, message: 'Item updated successfully' });
  } catch (error) {
    console.error('Error in updateCreateIndentItem:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function deleteCreateIndentItem(req, res) {
  try {
    const { id } = req.params;
    await annualIndentModel.deleteCreateIndentItem(id);
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error in deleteCreateIndentItem:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getMedicalCollegeAiDropdowns(req, res) {
  try {
    const data = await annualIndentModel.getMedicalCollegeAiDropdowns();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getMedicalCollegeAiDropdowns:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getMedicalCollegeAiReport(req, res) {
  try {
    const { finYearId, medicalCollegeId, categoryId } = req.query;
    const data = await annualIndentModel.getMedicalCollegeAiReport(finYearId, medicalCollegeId, categoryId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getMedicalCollegeAiReport:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getMcAiVsIssuanceDropdowns(req, res) {
  try {
    const data = await annualIndentModel.getMcAiVsIssuanceDropdowns();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getMcAiVsIssuanceDropdowns:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getMcAiVsIssuanceReport(req, res) {
  try {
    const { finYearId, categoryId, facilityId } = req.query;
    const data = await annualIndentModel.getMcAiVsIssuanceReport(finYearId, categoryId, facilityId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getMcAiVsIssuanceReport:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

module.exports = {
  getItems,
  getSummary,
  getDistributions,
  updateDistribution,
  deleteDistribution,
  getMcHospitalAiVsIssuance,
  getDownloadAiFormatData,
  getUploadForwardFinYears,
  getUploadForwardList,
  getCreateIndentHeader,
  getCreateIndentItems,
  updateCreateIndentItem,
  deleteCreateIndentItem,
  getMedicalCollegeAiDropdowns,
  getMedicalCollegeAiReport,
  getMcAiVsIssuanceDropdowns,
  getMcAiVsIssuanceReport
};
