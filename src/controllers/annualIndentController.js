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

async function getAyushDownloadFormatData(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 29609;
    const subCatId = req.query.subCatId || req.query.categoryId || 8;
    const data = await annualIndentModel.getAyushDownloadFormatData(facilityId, subCatId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getAyushDownloadFormatData:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getDownloadAiFormatData(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const categoryId = req.query.categoryId || 0;
    const facilityTypeId = req.query.facilityTypeId || req.user?.facilityTypeId || req.user?.facilityTypeID;
    const data = await annualIndentModel.getDownloadAiFormatData(facilityId, categoryId, facilityTypeId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getDownloadAiFormatData:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getDownloadNonEdlFormatData(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const categoryId = req.query.categoryId || 0;
    const data = await annualIndentModel.getDownloadNonEdlFormatData(facilityId, categoryId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getDownloadNonEdlFormatData:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getDownloadReagentNonEdlFormatData(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const facilityTypeId = req.query.facilityTypeId || req.user?.facilityTypeId || req.user?.facilityTypeID;
    const data = await annualIndentModel.getDownloadReagentNonEdlFormatData(facilityId, facilityTypeId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getDownloadReagentNonEdlFormatData:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getIndentCategories(req, res) {
  try {
    const data = await annualIndentModel.getIndentCategories();
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
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const { finYearId } = req.query;
    const result = await annualIndentModel.getUploadForwardList(facilityId, finYearId);
    res.json({ success: true, data: result.list, canAdd: result.canAdd });
  } catch (error) {
    console.error('Error in getUploadForwardList:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getNonEdlUploadForwardList(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const { finYearId, status } = req.query;
    const result = await annualIndentModel.getNonEdlUploadForwardList(facilityId, finYearId, status);
    res.json({ success: true, data: result.list, canAdd: result.canAdd, count: result.count });
  } catch (error) {
    console.error('Error in getNonEdlUploadForwardList:', error);
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
    res.json({ success: true, message: 'Indent Finalized Successfully' });
  } catch (error) {
    console.error('Error in freezeIndent:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function deleteIndent(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const { finYearId, indentId } = req.query;
    await annualIndentModel.deleteIndent(facilityId, finYearId, indentId);
    res.json({ success: true, message: 'Indent Deleted Successfully' });
  } catch (error) {
    console.error('Error in deleteIndent:', error);
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

async function uploadExcelIndentItems(req, res) {
  try {
    const facilityId = req.body.facilityId || req.user?.facilityId || 22595;
    const { finYearId, indentId, items } = req.body;
    const data = await annualIndentModel.uploadExcelIndentItems(facilityId, finYearId, indentId, items);
    res.json({ success: true, message: 'Excel items uploaded successfully', data });
  } catch (error) {
    console.error('Error in uploadExcelIndentItems:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getReagentUploadForwardList(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const { finYearId, status } = req.query;
    const result = await annualIndentModel.getReagentUploadForwardList(facilityId, finYearId, status);
    res.json({ success: true, data: result.list, canAdd: result.canAdd });
  } catch (error) {
    console.error('Error in getReagentUploadForwardList:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getReagentCreateIndentHeader(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const { finYearId, indentId } = req.query;
    const data = await annualIndentModel.getReagentCreateIndentHeader(facilityId, finYearId, indentId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getReagentCreateIndentHeader:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function generateReagentIndentHeader(req, res) {
  try {
    const facilityId = req.body.facilityId || req.user?.facilityId || 22595;
    const { finYearId } = req.body;
    const data = await annualIndentModel.generateReagentIndentHeader(facilityId, finYearId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in generateReagentIndentHeader:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}

async function getReagentCreateIndentItems(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const { finYearId, indentId } = req.query;
    const data = await annualIndentModel.getReagentCreateIndentItems(facilityId, finYearId, indentId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getReagentCreateIndentItems:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function uploadExcelReagentIndentItems(req, res) {
  try {
    const facilityId = req.body.facilityId || req.user?.facilityId || 22595;
    const { finYearId, indentId, items } = req.body;
    const data = await annualIndentModel.uploadExcelReagentIndentItems(facilityId, finYearId, indentId, items);
    res.json({ success: true, message: 'Reagent items uploaded successfully', data });
  } catch (error) {
    console.error('Error in uploadExcelReagentIndentItems:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}

async function freezeReagentIndent(req, res) {
  try {
    const facilityId = req.body.facilityId || req.user?.facilityId || 22595;
    const { finYearId, indentId } = req.body;
    await annualIndentModel.freezeReagentIndent(facilityId, finYearId, indentId);
    res.json({ success: true, message: 'Reagent indent finalized successfully' });
  } catch (error) {
    console.error('Error in freezeReagentIndent:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function deleteReagentIndent(req, res) {
  try {
    const facilityId = req.query.facilityId || req.body?.facilityId || req.user?.facilityId || 22595;
    const finYearId = req.query.finYearId || req.body?.finYearId;
    const indentId = req.query.indentId || req.body?.indentId;
    await annualIndentModel.deleteReagentIndent(facilityId, finYearId, indentId);
    res.json({ success: true, message: 'Reagent indent deleted successfully' });
  } catch (error) {
    console.error('Error in deleteReagentIndent:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getNonEdlCreateIndentHeader(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const { finYearId, indentId } = req.query;
    const data = await annualIndentModel.getNonEdlCreateIndentHeader(facilityId, finYearId, indentId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getNonEdlCreateIndentHeader:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function generateNonEdlIndentHeader(req, res) {
  try {
    const facilityId = req.body.facilityId || req.user?.facilityId || 22595;
    const { finYearId } = req.body;
    const data = await annualIndentModel.generateNonEdlIndentHeader(facilityId, finYearId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in generateNonEdlIndentHeader:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}

async function getNonEdlCreateIndentItems(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const { finYearId, indentId } = req.query;
    const data = await annualIndentModel.getNonEdlCreateIndentItems(facilityId, finYearId, indentId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getNonEdlCreateIndentItems:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function uploadExcelNonEdlIndentItems(req, res) {
  try {
    const facilityId = req.body.facilityId || req.user?.facilityId || 22595;
    const { finYearId, indentId, items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'No items provided for upload' });
    }
    const result = await annualIndentModel.uploadExcelNonEdlIndentItems(facilityId, finYearId, indentId, items);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in uploadExcelNonEdlIndentItems:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}

async function freezeNonEdlIndent(req, res) {
  try {
    const facilityId = req.body.facilityId || req.user?.facilityId || 22595;
    const { finYearId, indentId } = req.body;
    await annualIndentModel.freezeNonEdlIndent(facilityId, finYearId, indentId);
    res.json({ success: true, message: 'Non-EDL indent finalized successfully' });
  } catch (error) {
    console.error('Error in freezeNonEdlIndent:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function deleteNonEdlIndent(req, res) {
  try {
    const facilityId = req.query.facilityId || req.body?.facilityId || req.user?.facilityId || 22595;
    const finYearId = req.query.finYearId || req.body?.finYearId;
    const indentId = req.query.indentId || req.body?.indentId;
    await annualIndentModel.deleteNonEdlIndent(facilityId, finYearId, indentId);
    res.json({ success: true, message: 'Non-EDL indent deleted successfully' });
  } catch (error) {
    console.error('Error in deleteNonEdlIndent:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getNonEdlCreateFinYears(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || '22595';
    const mode = req.query.mode || '';
    const indentId = req.query.indentId || 0;
    const data = await annualIndentModel.getNonEdlCreateFinYears(facilityId, mode, indentId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getNonEdlCreateFinYears:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getReagentCreateFinYears(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || '22595';
    const mode = req.query.mode || '';
    const indentId = req.query.indentId || 0;
    const data = await annualIndentModel.getReagentCreateFinYears(facilityId, mode, indentId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getReagentCreateFinYears:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
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

async function getDaoForwardedList(req, res) {
  try {
    const facilityId = req.user.facilityId;
    const { finYearId } = req.query;
    const data = await annualIndentModel.getDaoForwardedList(facilityId, finYearId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getDaoForwardedList:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getDaoDetailItems(req, res) {
  try {
    const facilityId = req.user.facilityId;
    const { subCatId, finYearId } = req.query;
    if (!subCatId) {
      return res.status(400).json({ success: false, message: 'SubCatId is required' });
    }
    const data = await annualIndentModel.getDaoDetailItems(facilityId, subCatId, finYearId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getDaoDetailItems:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getDaoApprovalList(req, res) {
  try {
    const facilityId = req.user.facilityId;
    const { finYearId, categoryId, status } = req.query;
    const data = await annualIndentModel.getDaoApprovalList(facilityId, finYearId, categoryId, status);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getDaoApprovalList:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getDaoIndentItems(req, res) {
  try {
    const { indentId } = req.params;
    const data = await annualIndentModel.getDaoIndentItems(indentId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getDaoIndentItems:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function approveDaoIndent(req, res) {
  try {
    const userId = req.user.userId;
    const { indentId, items } = req.body;
    if (!indentId) {
      return res.status(400).json({ success: false, message: 'Indent ID is required' });
    }
    const result = await annualIndentModel.approveDaoIndent(indentId, userId, items);
    res.json({ success: true, message: 'Indent approved successfully', data: result });
  } catch (error) {
    console.error('Error in approveDaoIndent:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getDaoStatusReport(req, res) {
  try {
    const facilityId = req.user.facilityId;
    const { finYearId, categoryId } = req.query;
    const data = await annualIndentModel.getDaoStatusReport(facilityId, finYearId, categoryId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getDaoStatusReport:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getDaoItemWiseAi(req, res) {
  try {
    const facilityId = req.user.facilityId;
    const { finYearId, categoryId } = req.query;
    const data = await annualIndentModel.getDaoItemWiseAi(facilityId, finYearId, categoryId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getDaoItemWiseAi:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

module.exports = {
  getDaoForwardedList,
  getDaoDetailItems,
  getDaoApprovalList,
  getDaoIndentItems,
  approveDaoIndent,
  getDaoStatusReport,
  getDaoItemWiseAi,
  getIndentPdfItems,
  getNonEdlCreateFinYears,
  getReagentCreateFinYears,
  getItems,
  getSummary,
  getDistributions,
  updateDistribution,
  deleteDistribution,
  getMcHospitalAiVsIssuance,
  getAyushDownloadFormatData,
  getDownloadAiFormatData,
  getDownloadNonEdlFormatData,
  getDownloadReagentNonEdlFormatData,
  getIndentCategories,
  getUploadForwardFinYears,
  getUploadForwardList,
  getNonEdlUploadForwardList,
  getNonEdlCreateIndentHeader,
  generateNonEdlIndentHeader,
  getNonEdlCreateIndentItems,
  uploadExcelNonEdlIndentItems,
  freezeNonEdlIndent,
  deleteNonEdlIndent,
  getReagentUploadForwardList,
  getReagentCreateIndentHeader,
  generateReagentIndentHeader,
  getReagentCreateIndentItems,
  uploadExcelReagentIndentItems,
  freezeReagentIndent,
  deleteReagentIndent,
  getCreateIndentHeader,
  getCreateIndentItems,
  updateCreateIndentItem,
  deleteCreateIndentItem,
  generateIndentHeader,
  freezeIndent,
  deleteIndent,
  getMedicalCollegeAiDropdowns,
  getMedicalCollegeAiReport,
  getMcAiVsIssuanceDropdowns,
  getMcAiVsIssuanceReport,
  uploadExcelIndentItems
};
