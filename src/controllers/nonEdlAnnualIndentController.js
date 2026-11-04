const nonEdlAnnualIndentModel = require('../models/nonEdlAnnualIndentModel');

async function getDownloadNonEdlFormatData(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const categoryId = req.query.categoryId || 0;
    const data = await nonEdlAnnualIndentModel.getDownloadNonEdlFormatData(facilityId, categoryId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getDownloadNonEdlFormatData:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getNonEdlUploadForwardList(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const { finYearId, status } = req.query;
    const result = await nonEdlAnnualIndentModel.getNonEdlUploadForwardList(facilityId, finYearId, status);
    res.json({ success: true, data: result.list, canAdd: result.canAdd, count: result.count });
  } catch (error) {
    console.error('Error in getNonEdlUploadForwardList:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getNonEdlCreateIndentHeader(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const { finYearId, indentId } = req.query;
    const data = await nonEdlAnnualIndentModel.getNonEdlCreateIndentHeader(facilityId, finYearId, indentId);
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
    const data = await nonEdlAnnualIndentModel.generateNonEdlIndentHeader(facilityId, finYearId);
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
    const data = await nonEdlAnnualIndentModel.getNonEdlCreateIndentItems(facilityId, finYearId, indentId);
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
    const result = await nonEdlAnnualIndentModel.uploadExcelNonEdlIndentItems(facilityId, finYearId, indentId, items);
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
    await nonEdlAnnualIndentModel.freezeNonEdlIndent(facilityId, finYearId, indentId);
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
    await nonEdlAnnualIndentModel.deleteNonEdlIndent(facilityId, finYearId, indentId);
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
    const data = await nonEdlAnnualIndentModel.getNonEdlCreateFinYears(facilityId, mode, indentId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getNonEdlCreateFinYears:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

module.exports = {
  getDownloadNonEdlFormatData,
  getNonEdlUploadForwardList,
  getNonEdlCreateFinYears,
  getNonEdlCreateIndentHeader,
  generateNonEdlIndentHeader,
  getNonEdlCreateIndentItems,
  uploadExcelNonEdlIndentItems,
  freezeNonEdlIndent,
  deleteNonEdlIndent
};
