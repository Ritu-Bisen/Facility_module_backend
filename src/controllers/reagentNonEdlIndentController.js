const reagentNonEdlIndentModel = require('../models/reagentNonEdlIndentModel');

async function getDownloadReagentNonEdlFormatData(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const facilityTypeId = req.query.facilityTypeId || req.user?.facilityTypeId || req.user?.facilityTypeID;
    const data = await reagentNonEdlIndentModel.getDownloadReagentNonEdlFormatData(facilityId, facilityTypeId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getDownloadReagentNonEdlFormatData:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getReagentUploadForwardList(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const { finYearId, status } = req.query;
    const result = await reagentNonEdlIndentModel.getReagentUploadForwardList(facilityId, finYearId, status);
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
    const data = await reagentNonEdlIndentModel.getReagentCreateIndentHeader(facilityId, finYearId, indentId);
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
    const data = await reagentNonEdlIndentModel.generateReagentIndentHeader(facilityId, finYearId);
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
    const data = await reagentNonEdlIndentModel.getReagentCreateIndentItems(facilityId, finYearId, indentId);
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
    const data = await reagentNonEdlIndentModel.uploadExcelReagentIndentItems(facilityId, finYearId, indentId, items);
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
    await reagentNonEdlIndentModel.freezeReagentIndent(facilityId, finYearId, indentId);
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
    await reagentNonEdlIndentModel.deleteReagentIndent(facilityId, finYearId, indentId);
    res.json({ success: true, message: 'Reagent indent deleted successfully' });
  } catch (error) {
    console.error('Error in deleteReagentIndent:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getReagentCreateFinYears(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || '22595';
    const mode = req.query.mode || '';
    const indentId = req.query.indentId || 0;
    const data = await reagentNonEdlIndentModel.getReagentCreateFinYears(facilityId, mode, indentId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getReagentCreateFinYears:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

module.exports = {
  getDownloadReagentNonEdlFormatData,
  getReagentUploadForwardList,
  getReagentCreateFinYears,
  getReagentCreateIndentHeader,
  generateReagentIndentHeader,
  getReagentCreateIndentItems,
  uploadExcelReagentIndentItems,
  freezeReagentIndent,
  deleteReagentIndent
};
