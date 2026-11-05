const daoAnnualIndentModel = require('../models/daoAnnualIndentModel');

async function getFinYears(req, res) {
  try {
    const data = await daoAnnualIndentModel.getDaoFinYears();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in dao getFinYears:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getCategories(req, res) {
  try {
    const data = await daoAnnualIndentModel.getDaoCategories();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in dao getCategories:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getDrugs(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || req.user?.facilityid || req.user?.FACILITYID || 23633;
    const finYearId = req.query.finYearId || 547;
    const subcatId = req.query.subcatId || req.query.categoryId || 0;
    const data = await daoAnnualIndentModel.getDaoDrugs(facilityId, finYearId, subcatId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in dao getDrugs:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getFacilityItems(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || req.user?.facilityid || req.user?.FACILITYID || 23633;
    const finYearId = req.query.finYearId || 547;
    const itemId = req.query.itemId;
    if (!itemId || itemId === '0') {
      return res.json({ success: true, data: [] });
    }
    const data = await daoAnnualIndentModel.getDaoFacilityItems(facilityId, finYearId, itemId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in dao getFacilityItems:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function approveItem(req, res) {
  try {
    const facilityId = req.body.facilityId || req.user?.facilityId || req.user?.facilityid || req.user?.FACILITYID || 23633;
    const { anualIndentId, itemId, finYearId, approveQty } = req.body;
    if (!anualIndentId || !itemId || !facilityId) {
      return res.status(400).json({ success: false, error: 'Missing required parameters' });
    }
    await daoAnnualIndentModel.approveDaoItem(anualIndentId, itemId, facilityId, finYearId, approveQty);
    res.json({ success: true, message: 'Item approved successfully' });
  } catch (error) {
    console.error('Error in dao approveItem:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function approveBatchItems(req, res) {
  try {
    const { items, finYearId } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'No items provided' });
    }
    const result = await daoAnnualIndentModel.approveDaoBatchItems(items, finYearId);
    res.json(result);
  } catch (error) {
    console.error('Error in dao approveBatchItems:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getDispatchDetails(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || req.user?.facilityid || req.user?.FACILITYID || 23633;
    const finYearId = req.query.finYearId || 547;
    const data = await daoAnnualIndentModel.getDaoDispatchDetails(facilityId, finYearId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in dao getDispatchDetails:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function saveDispatchDetails(req, res) {
  try {
    const facilityId = req.body.facilityId || req.user?.facilityId || req.user?.facilityid || req.user?.FACILITYID || 23633;
    const { finYearId, dispatchNo, dispatchDate } = req.body;
    await daoAnnualIndentModel.saveDaoDispatchDetails(facilityId, finYearId, dispatchNo, dispatchDate);
    res.json({ success: true, message: 'Dispatch details saved successfully' });
  } catch (error) {
    console.error('Error in dao saveDispatchDetails:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function freezeIndent(req, res) {
  try {
    const facilityId = req.body.facilityId || req.user?.facilityId || req.user?.facilityid || req.user?.FACILITYID || 23633;
    const { finYearId } = req.body;
    const result = await daoAnnualIndentModel.freezeDaoIndent(facilityId, finYearId);
    res.json(result);
  } catch (error) {
    console.error('Error in dao freezeIndent:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

module.exports = {
  getFinYears,
  getCategories,
  getDrugs,
  getFacilityItems,
  approveItem,
  approveBatchItems,
  getDispatchDetails,
  saveDispatchDetails,
  freezeIndent,

  // Aliases
  getDaoFinYears: getFinYears,
  getDaoCategories: getCategories,
  getDaoDrugs: getDrugs,
  getDaoFacilityItems: getFacilityItems,
  approveDaoItem: approveItem,
  approveDaoBatchItems: approveBatchItems,
  getDaoDispatchDetails: getDispatchDetails,
  saveDaoDispatchDetails: saveDispatchDetails,
  freezeDaoIndent: freezeIndent
};
