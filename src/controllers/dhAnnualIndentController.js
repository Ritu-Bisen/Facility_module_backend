const dhAnnualIndentModel = require('../models/dhAnnualIndentModel');

async function getDhUploadForwardFinYears(req, res) {
  try {
    const data = await dhAnnualIndentModel.getDhUploadForwardFinYears();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getDhUploadForwardFinYears:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getDhUploadForwardList(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const { finYearId, status } = req.query;
    const result = await dhAnnualIndentModel.getDhUploadForwardList(facilityId, finYearId, status);
    res.json({ success: true, data: result.list, canAdd: result.canAdd });
  } catch (error) {
    console.error('Error in getDhUploadForwardList:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getDhCreateIndentHeader(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const { finYearId, indentId } = req.query;
    const data = await dhAnnualIndentModel.getDhCreateIndentHeader(facilityId, finYearId, indentId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getDhCreateIndentHeader:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function generateDhIndentHeader(req, res) {
  try {
    const facilityId = req.body.facilityId || req.user?.facilityId || 22595;
    const { finYearId } = req.body;
    const data = await dhAnnualIndentModel.generateDhIndentHeader(facilityId, finYearId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in generateDhIndentHeader:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}

async function getDhCreateIndentItems(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 22595;
    const { finYearId, indentId } = req.query;
    const data = await dhAnnualIndentModel.getDhCreateIndentItems(facilityId, finYearId, indentId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getDhCreateIndentItems:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function updateDhCreateIndentItem(req, res) {
  try {
    const { anualIndentId, consumption, actualConsumption, projectedConsumption, currentStock, facilityIndentQty, rate } = req.body;
    await dhAnnualIndentModel.updateDhCreateIndentItem(anualIndentId, consumption, actualConsumption, projectedConsumption, currentStock, facilityIndentQty, rate);
    res.json({ success: true, message: 'Item updated successfully' });
  } catch (error) {
    console.error('Error in updateDhCreateIndentItem:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function deleteDhCreateIndentItem(req, res) {
  try {
    const { id } = req.params;
    await dhAnnualIndentModel.deleteDhCreateIndentItem(id);
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error in deleteDhCreateIndentItem:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function uploadExcelDhIndentItems(req, res) {
  try {
    const facilityId = req.body.facilityId || req.user?.facilityId || 22595;
    const { finYearId, indentId, items } = req.body;
    const data = await dhAnnualIndentModel.uploadExcelDhIndentItems(facilityId, finYearId, indentId, items);
    res.json({ success: true, message: 'DH items uploaded successfully', data });
  } catch (error) {
    console.error('Error in uploadExcelDhIndentItems:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}

async function freezeDhIndent(req, res) {
  try {
    const facilityId = req.body.facilityId || req.user?.facilityId || 22595;
    const { finYearId, indentId } = req.body;
    await dhAnnualIndentModel.freezeDhIndent(facilityId, finYearId, indentId);
    res.json({ success: true, message: 'DH indent finalized successfully' });
  } catch (error) {
    console.error('Error in freezeDhIndent:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function deleteDhIndent(req, res) {
  try {
    const facilityId = req.query.facilityId || req.body?.facilityId || req.user?.facilityId || 22595;
    const finYearId = req.query.finYearId || req.body?.finYearId;
    const indentId = req.query.indentId || req.body?.indentId;
    await dhAnnualIndentModel.deleteDhIndent(facilityId, finYearId, indentId);
    res.json({ success: true, message: 'DH indent deleted successfully' });
  } catch (error) {
    console.error('Error in deleteDhIndent:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getDhDownloadFormatData(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || req.user?.facilityid || req.user?.FACILITYID || 23393;
    const categoryId = req.query.categoryId || 0;
    const facilityTypeId = req.query.facilityTypeId || req.user?.facilityTypeId || req.user?.facilityTypeID || req.user?.FACILITYTYPEID;
    const data = await dhAnnualIndentModel.getDhDownloadFormatData(facilityId, categoryId, facilityTypeId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getDhDownloadFormatData:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getDhIndentPdfItems(req, res) {
  try {
    const { indentId } = req.query;
    if (!indentId) {
      return res.status(400).json({ success: false, error: 'Indent ID is required' });
    }
    const data = await dhAnnualIndentModel.getDhIndentPdfItems(indentId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getDhIndentPdfItems:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

module.exports = {
  getDhUploadForwardFinYears,
  getDhUploadForwardList,
  getDhCreateIndentHeader,
  generateDhIndentHeader,
  getDhCreateIndentItems,
  updateDhCreateIndentItem,
  deleteDhCreateIndentItem,
  uploadExcelDhIndentItems,
  freezeDhIndent,
  deleteDhIndent,
  getDhDownloadFormatData,
  getDhIndentPdfItems
};
