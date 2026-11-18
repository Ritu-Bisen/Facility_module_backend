const cmhoAnnualIndentModel = require('../models/cmhoAnnualIndentModel');

async function getFinYears(req, res) {
  try {
    const data = await cmhoAnnualIndentModel.getCmhoFinYears();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in cmhoAnnualIndentController.getFinYears:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getStatusReport(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || req.user?.facilityid || req.user?.FACILITYID;
    let districtId = req.query.districtId || req.user?.districtId || req.user?.districtid || req.user?.DISTRICTID;
    const finYearId = req.query.finYearId || 547;

    if (!districtId && facilityId) {
      districtId = await cmhoAnnualIndentModel.getFacilityDistrictId(facilityId);
    }

    if (!districtId) {
      return res.status(400).json({ success: false, error: 'District ID is required' });
    }

    const data = await cmhoAnnualIndentModel.getCmhoIndentStatusReport(districtId, finYearId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in cmhoAnnualIndentController.getStatusReport:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

module.exports = {
  getFinYears,
  getStatusReport
};
