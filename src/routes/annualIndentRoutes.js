const express = require('express');
const router = express.Router();
const annualIndentController = require('../controllers/annualIndentController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/items', annualIndentController.getItems);
router.get('/summary', annualIndentController.getSummary);
router.get('/distributions', annualIndentController.getDistributions);
router.get('/mc-ai-vs-issuance', annualIndentController.getMcHospitalAiVsIssuance);
router.get('/mc-ai-vs-issuance/dropdowns', annualIndentController.getMcAiVsIssuanceDropdowns);
router.get('/mc-ai-vs-issuance/report', annualIndentController.getMcAiVsIssuanceReport);
router.get('/download-format', annualIndentController.getDownloadAiFormatData);
router.get('/upload-forward/fin-years', annualIndentController.getUploadForwardFinYears);
router.get('/upload-forward/list', annualIndentController.getUploadForwardList);
router.get('/create/header', annualIndentController.getCreateIndentHeader);
router.get('/create/items', annualIndentController.getCreateIndentItems);
router.get('/medical-college-ai/dropdowns', annualIndentController.getMedicalCollegeAiDropdowns);
router.get('/medical-college-ai', annualIndentController.getMedicalCollegeAiReport);
router.put('/create/item', annualIndentController.updateCreateIndentItem);
router.delete('/create/item/:id', annualIndentController.deleteCreateIndentItem);
router.post('/distribute', annualIndentController.updateDistribution);
router.delete('/distribute/:id', annualIndentController.deleteDistribution);

module.exports = router;
