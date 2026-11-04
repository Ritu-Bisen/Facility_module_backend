const express = require('express');
const router = express.Router();
const medicalCollegeAiController = require('../controllers/medicalCollegeAiController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

// Medical College AI routes
router.get('/dropdowns', medicalCollegeAiController.getMedicalCollegeAiDropdowns);
router.get('/report', medicalCollegeAiController.getMedicalCollegeAiReport);
router.get('/', medicalCollegeAiController.getMedicalCollegeAiReport);

// MC / Hospital AI vs Issuance routes
router.get('/hospital-ai-vs-issuance', medicalCollegeAiController.getMcHospitalAiVsIssuance);
router.get('/mc-ai-vs-issuance/dropdowns', medicalCollegeAiController.getMcAiVsIssuanceDropdowns);
router.get('/mc-ai-vs-issuance/report', medicalCollegeAiController.getMcAiVsIssuanceReport);
router.get('/mc-ai-vs-issuance', medicalCollegeAiController.getMcHospitalAiVsIssuance);

module.exports = router;
