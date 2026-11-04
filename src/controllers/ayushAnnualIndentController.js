const ayushAnnualIndentModel = require('../models/ayushAnnualIndentModel');

// ==========================================
// 1. AYUSH Upload & Forward Page (Image 2)
// ==========================================

async function getAyushUploadForwardFinYears(req, res) {
  try {
    const data = await ayushAnnualIndentModel.getAyushUploadForwardFinYears();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getAyushUploadForwardFinYears:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getAyushCategories(req, res) {
  try {
    const usrFacilityID = req.query.usrFacilityID || req.user?.facilityId || 29609;
    const data = await ayushAnnualIndentModel.getAyushCategories(usrFacilityID);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getAyushCategories:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getAyushUploadForwardList(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 29609;
    const { finYearId, status } = req.query;
    const result = await ayushAnnualIndentModel.getAyushUploadForwardList(facilityId, finYearId, status);
    res.json({ success: true, data: result.list, canAdd: result.canAdd });
  } catch (error) {
    console.error('Error in getAyushUploadForwardList:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getAyushDownloadFormatData(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 29609;
    const subCatId = req.query.subCatId || req.query.categoryId || 8;
    const data = await ayushAnnualIndentModel.getAyushDownloadFormatData(facilityId, subCatId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getAyushDownloadFormatData:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getAyushCreateIndentHeader(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 29609;
    const { finYearId, indentId } = req.query;
    const data = await ayushAnnualIndentModel.getAyushCreateIndentHeader(facilityId, finYearId, indentId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getAyushCreateIndentHeader:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function generateAyushIndentHeader(req, res) {
  try {
    const facilityId = req.body.facilityId || req.user?.facilityId || 29609;
    const { finYearId, categoryId } = req.body;
    const data = await ayushAnnualIndentModel.generateAyushIndentHeader(facilityId, finYearId, categoryId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in generateAyushIndentHeader:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}

async function getAyushCreateIndentItems(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 29609;
    const { finYearId, indentId } = req.query;
    const data = await ayushAnnualIndentModel.getAyushCreateIndentItems(facilityId, finYearId, indentId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getAyushCreateIndentItems:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function updateAyushCreateIndentItem(req, res) {
  try {
    const { anualIndentId, consumption, actualConsumption, projectedConsumption, currentStock, facilityIndentQty, rate } = req.body;
    await ayushAnnualIndentModel.updateAyushCreateIndentItem(anualIndentId, consumption, actualConsumption, projectedConsumption, currentStock, facilityIndentQty, rate);
    res.json({ success: true, message: 'Ayush item updated successfully' });
  } catch (error) {
    console.error('Error in updateAyushCreateIndentItem:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function deleteAyushCreateIndentItem(req, res) {
  try {
    const { id } = req.params;
    await ayushAnnualIndentModel.deleteAyushCreateIndentItem(id);
    res.json({ success: true, message: 'Ayush item deleted successfully' });
  } catch (error) {
    console.error('Error in deleteAyushCreateIndentItem:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function uploadExcelAyushIndentItems(req, res) {
  try {
    const facilityId = req.body.facilityId || req.user?.facilityId || 29609;
    const { finYearId, indentId, items } = req.body;
    const data = await ayushAnnualIndentModel.uploadExcelAyushIndentItems(facilityId, finYearId, indentId, items);
    res.json({ success: true, message: 'Ayush items uploaded successfully', data });
  } catch (error) {
    console.error('Error in uploadExcelAyushIndentItems:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}

async function freezeAyushIndent(req, res) {
  try {
    const facilityId = req.body.facilityId || req.user?.facilityId || 29609;
    const { finYearId, indentId } = req.body;
    await ayushAnnualIndentModel.freezeAyushIndent(facilityId, finYearId, indentId);
    res.json({ success: true, message: 'Ayush indent finalized successfully' });
  } catch (error) {
    console.error('Error in freezeAyushIndent:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function deleteAyushIndent(req, res) {
  try {
    const facilityId = req.query.facilityId || req.body?.facilityId || req.user?.facilityId || 29609;
    const finYearId = req.query.finYearId || req.body?.finYearId;
    const indentId = req.query.indentId || req.body?.indentId;
    await ayushAnnualIndentModel.deleteAyushIndent(facilityId, finYearId, indentId);
    res.json({ success: true, message: 'Ayush indent deleted successfully' });
  } catch (error) {
    console.error('Error in deleteAyushIndent:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

// ==========================================
// 2. DAO Functions
// ==========================================

async function getDaoForwardedList(req, res) {
  try {
    const facilityId = req.user.facilityId;
    const { finYearId } = req.query;
    const data = await ayushAnnualIndentModel.getDaoForwardedList(facilityId, finYearId);
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
    const data = await ayushAnnualIndentModel.getDaoDetailItems(facilityId, subCatId, finYearId);
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
    const data = await ayushAnnualIndentModel.getDaoApprovalList(facilityId, finYearId, categoryId, status);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getDaoApprovalList:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getDaoIndentItems(req, res) {
  try {
    const { indentId } = req.params;
    const data = await ayushAnnualIndentModel.getDaoIndentItems(indentId);
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
    const result = await ayushAnnualIndentModel.approveDaoIndent(indentId, userId, items);
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
    const data = await ayushAnnualIndentModel.getDaoStatusReport(facilityId, finYearId, categoryId);
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
    const data = await ayushAnnualIndentModel.getDaoItemWiseAi(facilityId, finYearId, categoryId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getDaoItemWiseAi:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getAyushIndentPdfItems(req, res) {
  try {
    const { indentId } = req.query;
    if (!indentId) {
      return res.status(400).json({ success: false, error: 'Indent ID is required' });
    }
    const data = await ayushAnnualIndentModel.getAyushIndentPdfItems(indentId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getAyushIndentPdfItems:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

module.exports = {
  // AYUSH Upload & Forward Page (Image 2)
  getAyushUploadForwardFinYears,
  getAyushCategories,
  getAyushUploadForwardList,
  getAyushDownloadFormatData,
  getAyushCreateIndentHeader,
  generateAyushIndentHeader,
  getAyushCreateIndentItems,
  updateAyushCreateIndentItem,
  deleteAyushCreateIndentItem,
  uploadExcelAyushIndentItems,
  freezeAyushIndent,
  deleteAyushIndent,
  getAyushIndentPdfItems,

  // DAO Functions
  getDaoForwardedList,
  getDaoDetailItems,
  getDaoApprovalList,
  getDaoIndentItems,
  approveDaoIndent,
  getDaoStatusReport,
  getDaoItemWiseAi
};
