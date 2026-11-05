const annualIndentModel = require('../models/annualIndentModel');

// Import separated specialized controllers
const dhAnnualIndentController = require('./dhAnnualIndentController');
const nonEdlAnnualIndentController = require('./nonEdlAnnualIndentController');
const reagentNonEdlIndentController = require('./reagentNonEdlIndentController');
const ayushAnnualIndentController = require('./ayushAnnualIndentController');
const medicalCollegeAiController = require('./medicalCollegeAiController');

async function getItems(req, res) {
  try {
    const facilityId = req.user?.facilityId || 23246;
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
    
    if (!issueItemId || issueItemId == 0) {
      if (!indentId || !targetFacilityId || !itemId || !itemCode || !distQty) {
         return res.status(400).json({ error: 'Missing parameters for insertion' });
      }
      await annualIndentModel.insertDistribution(indentId, targetFacilityId, itemId, itemCode, distQty);
      return res.json({ success: true, message: 'Distribution inserted successfully' });
    } else {
      if (!distQty && distQty !== 0) {
        return res.status(400).json({ error: 'Missing distQty for update' });
      }
      await annualIndentModel.updateDistribution(issueItemId, distQty);
      return res.json({ success: true, message: 'Distribution updated successfully' });
    }
  } catch (error) {
    console.error('Error in updateDistribution:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function deleteDistribution(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Distribution ID is required' });

    await annualIndentModel.deleteDistribution(id);
    res.json({ success: true, message: 'Distribution deleted successfully' });
  } catch (error) {
    console.error('Error in deleteDistribution:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function getDownloadAiFormatData(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || req.user?.facilityid || req.user?.FACILITYID || 23393;
    const categoryId = req.query.categoryId || 0;
    const facilityTypeId = req.query.facilityTypeId || req.user?.facilityTypeId || req.user?.facilityTypeID || req.user?.FACILITYTYPEID;
    const data = await annualIndentModel.getDownloadAiFormatData(facilityId, categoryId, facilityTypeId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getDownloadAiFormatData:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getIndentCategories(req, res) {
  try {
    const usrFacilityID = req.query.usrFacilityID || req.user?.facilityId || 29609;
    const data = await annualIndentModel.getIndentCategories(usrFacilityID);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getIndentCategories:', error);
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
    const isDh = req.query.isDh === 'true' || req.query.isDh === true;
    if (isDh) {
      return await dhAnnualIndentController.getDhUploadForwardList(req, res);
    }
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const { finYearId } = req.query;
    const result = await annualIndentModel.getUploadForwardList(facilityId, finYearId);
    res.json({ success: true, data: result.list, canAdd: result.canAdd });
  } catch (error) {
    console.error('Error in getUploadForwardList:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getCreateIndentHeader(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const { finYearId, indentId } = req.query;
    const data = await annualIndentModel.getCreateIndentHeader(facilityId, finYearId, indentId);
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

async function generateIndentHeader(req, res) {
  try {
    const facilityId = req.body.facilityId || req.user?.facilityId || 22595;
    const { finYearId, categoryId } = req.body;
    const data = await annualIndentModel.generateIndentHeader(facilityId, finYearId, categoryId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in generateIndentHeader:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function freezeIndent(req, res) {
  try {
    const facilityId = req.body.facilityId || req.user?.facilityId || 22595;
    const { finYearId, indentId } = req.body;
    await annualIndentModel.freezeIndent(facilityId, finYearId, indentId);
    res.json({ success: true, message: 'Indent finalized successfully' });
  } catch (error) {
    console.error('Error in freezeIndent:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function deleteIndent(req, res) {
  try {
    const facilityId = req.query.facilityId || req.body?.facilityId || req.user?.facilityId || 22595;
    const finYearId = req.query.finYearId || req.body?.finYearId;
    const indentId = req.query.indentId || req.body?.indentId;
    await annualIndentModel.deleteIndent(facilityId, finYearId, indentId);
    res.json({ success: true, message: 'Indent deleted successfully' });
  } catch (error) {
    console.error('Error in deleteIndent:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function uploadExcelIndentItems(req, res) {
  try {
    const facilityId = req.body.facilityId || req.user?.facilityId || 22595;
    const { finYearId, indentId, items } = req.body;
    const data = await annualIndentModel.uploadExcelIndentItems(facilityId, finYearId, indentId, items);
    res.json({ success: true, message: 'Excel items uploaded successfully', data });
  } catch (error) {
    console.error('Error in uploadExcelIndentItems:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}

async function getIndentPdfItems(req, res) {
  try {
    const { indentId } = req.query;
    if (!indentId) {
      return res.status(400).json({ success: false, error: 'indentId is required' });
    }
    const data = await annualIndentModel.getIndentPdfItems(indentId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getIndentPdfItems:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

module.exports = {
  // Core Annual Indent Controllers
  getItems,
  getSummary,
  getDistributions,
  updateDistribution,
  deleteDistribution,
  getDownloadAiFormatData,
  getIndentCategories,
  getUploadForwardFinYears,
  getUploadForwardList,
  getCreateIndentHeader,
  getCreateIndentItems,
  updateCreateIndentItem,
  deleteCreateIndentItem,
  generateIndentHeader,
  freezeIndent,
  deleteIndent,
  uploadExcelIndentItems,
  getIndentPdfItems,

  // DH Annual Indent Controllers (delegated - Image 1)
  getDhUploadForwardFinYears: dhAnnualIndentController.getDhUploadForwardFinYears,
  getDhUploadForwardList: dhAnnualIndentController.getDhUploadForwardList,
  getDhCreateIndentHeader: dhAnnualIndentController.getDhCreateIndentHeader,
  generateDhIndentHeader: dhAnnualIndentController.generateDhIndentHeader,
  getDhCreateIndentItems: dhAnnualIndentController.getDhCreateIndentItems,
  updateDhCreateIndentItem: dhAnnualIndentController.updateDhCreateIndentItem,
  deleteDhCreateIndentItem: dhAnnualIndentController.deleteDhCreateIndentItem,
  uploadExcelDhIndentItems: dhAnnualIndentController.uploadExcelDhIndentItems,
  freezeDhIndent: dhAnnualIndentController.freezeDhIndent,
  deleteDhIndent: dhAnnualIndentController.deleteDhIndent,
  getDhDownloadFormatData: dhAnnualIndentController.getDhDownloadFormatData,
  getDhIndentPdfItems: dhAnnualIndentController.getDhIndentPdfItems,

  // Non-EDL Controllers (delegated)
  getDownloadNonEdlFormatData: nonEdlAnnualIndentController.getDownloadNonEdlFormatData,
  getNonEdlUploadForwardList: nonEdlAnnualIndentController.getNonEdlUploadForwardList,
  getNonEdlCreateFinYears: nonEdlAnnualIndentController.getNonEdlCreateFinYears,
  getNonEdlCreateIndentHeader: nonEdlAnnualIndentController.getNonEdlCreateIndentHeader,
  generateNonEdlIndentHeader: nonEdlAnnualIndentController.generateNonEdlIndentHeader,
  getNonEdlCreateIndentItems: nonEdlAnnualIndentController.getNonEdlCreateIndentItems,
  uploadExcelNonEdlIndentItems: nonEdlAnnualIndentController.uploadExcelNonEdlIndentItems,
  freezeNonEdlIndent: nonEdlAnnualIndentController.freezeNonEdlIndent,
  deleteNonEdlIndent: nonEdlAnnualIndentController.deleteNonEdlIndent,

  // Reagent Non-EDL Controllers (delegated)
  getDownloadReagentNonEdlFormatData: reagentNonEdlIndentController.getDownloadReagentNonEdlFormatData,
  getReagentUploadForwardList: reagentNonEdlIndentController.getReagentUploadForwardList,
  getReagentCreateFinYears: reagentNonEdlIndentController.getReagentCreateFinYears,
  getReagentCreateIndentHeader: reagentNonEdlIndentController.getReagentCreateIndentHeader,
  generateReagentIndentHeader: reagentNonEdlIndentController.generateReagentIndentHeader,
  getReagentCreateIndentItems: reagentNonEdlIndentController.getReagentCreateIndentItems,
  uploadExcelReagentIndentItems: reagentNonEdlIndentController.uploadExcelReagentIndentItems,
  freezeReagentIndent: reagentNonEdlIndentController.freezeReagentIndent,
  deleteReagentIndent: reagentNonEdlIndentController.deleteReagentIndent,

  // Ayush Controllers (delegated - Image 2)
  getAyushUploadForwardFinYears: ayushAnnualIndentController.getAyushUploadForwardFinYears,
  getAyushCategories: ayushAnnualIndentController.getAyushCategories,
  getAyushUploadForwardList: ayushAnnualIndentController.getAyushUploadForwardList,
  getAyushDownloadFormatData: ayushAnnualIndentController.getAyushDownloadFormatData,
  getAyushCreateIndentHeader: ayushAnnualIndentController.getAyushCreateIndentHeader,
  generateAyushIndentHeader: ayushAnnualIndentController.generateAyushIndentHeader,
  getAyushCreateIndentItems: ayushAnnualIndentController.getAyushCreateIndentItems,
  updateAyushCreateIndentItem: ayushAnnualIndentController.updateAyushCreateIndentItem,
  deleteAyushCreateIndentItem: ayushAnnualIndentController.deleteAyushCreateIndentItem,
  uploadExcelAyushIndentItems: ayushAnnualIndentController.uploadExcelAyushIndentItems,
  freezeAyushIndent: ayushAnnualIndentController.freezeAyushIndent,
  deleteAyushIndent: ayushAnnualIndentController.deleteAyushIndent,
  getAyushIndentPdfItems: ayushAnnualIndentController.getAyushIndentPdfItems,
  getDaoForwardedList: ayushAnnualIndentController.getDaoForwardedList,
  getDaoDetailItems: ayushAnnualIndentController.getDaoDetailItems,
  getDaoApprovalList: ayushAnnualIndentController.getDaoApprovalList,
  getDaoIndentItems: ayushAnnualIndentController.getDaoIndentItems,
  approveDaoIndent: ayushAnnualIndentController.approveDaoIndent,
  getDaoStatusReport: ayushAnnualIndentController.getDaoStatusReport,
  getDaoItemWiseAi: ayushAnnualIndentController.getDaoItemWiseAi,

  // Medical College AI Controllers (delegated)
  getMedicalCollegeAiDropdowns: medicalCollegeAiController.getMedicalCollegeAiDropdowns,
  getMedicalCollegeAiReport: medicalCollegeAiController.getMedicalCollegeAiReport,
  getMcAiVsIssuanceDropdowns: medicalCollegeAiController.getMcAiVsIssuanceDropdowns,
  getMcAiVsIssuanceReport: medicalCollegeAiController.getMcAiVsIssuanceReport,
  getMcHospitalAiVsIssuance: medicalCollegeAiController.getMcHospitalAiVsIssuance
};
