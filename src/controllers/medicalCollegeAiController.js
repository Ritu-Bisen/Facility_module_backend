const medicalCollegeAiModel = require('../models/medicalCollegeAiModel');

async function getMedicalCollegeAiDropdowns(req, res) {
  try {
    const data = await medicalCollegeAiModel.getMedicalCollegeAiDropdowns();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getMedicalCollegeAiDropdowns:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getMedicalCollegeAiReport(req, res) {
  try {
    const { finYearId, medicalCollegeId, categoryId } = req.query;
    const data = await medicalCollegeAiModel.getMedicalCollegeAiReport(finYearId, medicalCollegeId, categoryId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getMedicalCollegeAiReport:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getMcAiVsIssuanceDropdowns(req, res) {
  try {
    const data = await medicalCollegeAiModel.getMcAiVsIssuanceDropdowns();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getMcAiVsIssuanceDropdowns:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getMcAiVsIssuanceReport(req, res) {
  try {
    const { finYearId, categoryId, facilityId } = req.query;
    const data = await medicalCollegeAiModel.getMcAiVsIssuanceReport(finYearId, categoryId, facilityId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getMcAiVsIssuanceReport:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getMcHospitalAiVsIssuance(req, res) {
  try {
    const facilityId = req.query.facilityId || req.user?.facilityId || 23393;
    const data = await medicalCollegeAiModel.getMcHospitalAiVsIssuance(facilityId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getMcHospitalAiVsIssuance:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

module.exports = {
  getMedicalCollegeAiDropdowns,
  getMedicalCollegeAiReport,
  getMcAiVsIssuanceDropdowns,
  getMcAiVsIssuanceReport,
  getMcHospitalAiVsIssuance
};
