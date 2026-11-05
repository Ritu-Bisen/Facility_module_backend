const chcAnnualIndentModel = require('../models/chcAnnualIndentModel');

async function getFinYears(req, res) {
  try {
    const data = await chcAnnualIndentModel.getChcFinYears();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getFinYears:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getDrugs(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || req.user?.facilityid || req.user?.FACILITYID || 23393;
    const finYearId = req.query.finYearId || 547;
    const data = await chcAnnualIndentModel.getChcDrugs(facilityId, finYearId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getDrugs:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getFacilityItems(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || req.user?.facilityid || req.user?.FACILITYID || 23393;
    const finYearId = req.query.finYearId || 547;
    const itemId = req.query.itemId;
    if (!itemId || itemId === '0') {
      return res.json({ success: true, data: [] });
    }
    const data = await chcAnnualIndentModel.getChcFacilityItems(facilityId, finYearId, itemId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getFacilityItems:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function approveItem(req, res) {
  try {
    const facilityId = req.body.facilityId || req.user?.facilityId || req.user?.facilityid || req.user?.FACILITYID;
    const { anualIndentId, itemId, finYearId, approveQty } = req.body;
    if (!anualIndentId || !itemId || !facilityId) {
      return res.status(400).json({ success: false, error: 'Missing required parameters' });
    }
    await chcAnnualIndentModel.approveChcItem(anualIndentId, itemId, facilityId, finYearId, approveQty);
    res.json({ success: true, message: 'Item approved successfully' });
  } catch (error) {
    console.error('Error in approveItem:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function approveBatchItems(req, res) {
  try {
    const { items, finYearId } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'No items provided for approval' });
    }
    const result = await chcAnnualIndentModel.approveChcBatchItems(items, finYearId);
    res.json({ success: true, updatedCount: result.updatedCount, message: `${result.updatedCount} items updated successfully` });
  } catch (error) {
    console.error('Error in approveBatchItems:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getDispatchDetails(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || req.user?.facilityid || req.user?.FACILITYID || 23393;
    const finYearId = req.query.finYearId || 547;
    const data = await chcAnnualIndentModel.getChcDispatchDetails(facilityId, finYearId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getDispatchDetails:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function saveDispatchDetails(req, res) {
  try {
    const facilityId = req.body.facilityId || req.user?.facilityId || req.user?.facilityid || req.user?.FACILITYID || 23393;
    const { finYearId, dispatchNo, dispatchDate } = req.body;
    await chcAnnualIndentModel.saveChcDispatchDetails(facilityId, finYearId, dispatchNo, dispatchDate);
    res.json({ success: true, message: 'Dispatch details saved successfully' });
  } catch (error) {
    console.error('Error in saveDispatchDetails:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function freezeIndent(req, res) {
  try {
    const facilityId = req.body.facilityId || req.user?.facilityId || req.user?.facilityid || req.user?.FACILITYID || 23393;
    const { finYearId } = req.body;
    const result = await chcAnnualIndentModel.freezeChcIndent(facilityId, finYearId);
    res.json(result);
  } catch (error) {
    console.error('Error in freezeIndent:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

module.exports = {
  getFinYears,
  getDrugs,
  getFacilityItems,
  approveItem,
  approveBatchItems,
  getDispatchDetails,
  saveDispatchDetails,
  freezeIndent,

  // Aliases with Chc prefix
  getChcFinYears: getFinYears,
  getChcDrugs: getDrugs,
  getChcFacilityItems: getFacilityItems,
  approveChcItem: approveItem,
  approveChcBatchItems: approveBatchItems,
  getChcDispatchDetails: getDispatchDetails,
  saveChcDispatchDetails: saveDispatchDetails,
  freezeChcIndent: freezeIndent
};
