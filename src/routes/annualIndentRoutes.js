const express = require('express');
const router = express.Router();
const annualIndentController = require('../controllers/annualIndentController');
const dhAnnualIndentController = require('../controllers/dhAnnualIndentController');
const nonEdlAnnualIndentController = require('../controllers/nonEdlAnnualIndentController');
const reagentNonEdlIndentController = require('../controllers/reagentNonEdlIndentController');
const ayushAnnualIndentController = require('../controllers/ayushAnnualIndentController');
const medicalCollegeAiController = require('../controllers/medicalCollegeAiController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

// ==========================================
// 1. Core Annual Indent (EDL) Routes
// ==========================================
router.get('/items', annualIndentController.getItems);
router.get('/summary', annualIndentController.getSummary);
router.get('/distributions', annualIndentController.getDistributions);
router.post('/distribute', annualIndentController.updateDistribution);
router.delete('/distribute/:id', annualIndentController.deleteDistribution);
router.get('/download-format', annualIndentController.getDownloadAiFormatData);
router.get('/categories', annualIndentController.getIndentCategories);
router.get('/upload-forward/fin-years', annualIndentController.getUploadForwardFinYears);
router.get('/upload-forward/list', annualIndentController.getUploadForwardList);
router.get('/create/header', annualIndentController.getCreateIndentHeader);
router.get('/create/items', annualIndentController.getCreateIndentItems);
router.put('/create/item', annualIndentController.updateCreateIndentItem);
router.delete('/create/item/:id', annualIndentController.deleteCreateIndentItem);
router.post('/create/generate-header', annualIndentController.generateIndentHeader);
router.post('/create/upload-excel', annualIndentController.uploadExcelIndentItems);
router.post('/create/freeze', annualIndentController.freezeIndent);
router.delete('/create/indent', annualIndentController.deleteIndent);
router.get('/pdf/items', annualIndentController.getIndentPdfItems);

// ==========================================
// 2. DH Upload & Forward Annual Indent Routes (Delegated - Image 1)
// ==========================================
router.get('/upload-forward-dh/fin-years', dhAnnualIndentController.getDhUploadForwardFinYears);
router.get('/upload-forward-dh/list', dhAnnualIndentController.getDhUploadForwardList);
router.get('/dh/download-format', dhAnnualIndentController.getDhDownloadFormatData);
router.get('/dh/pdf/items', dhAnnualIndentController.getDhIndentPdfItems);
router.get('/dh/create/header', dhAnnualIndentController.getDhCreateIndentHeader);
router.post('/dh/create/generate-header', dhAnnualIndentController.generateDhIndentHeader);
router.get('/dh/create/items', dhAnnualIndentController.getDhCreateIndentItems);
router.put('/dh/create/item', dhAnnualIndentController.updateDhCreateIndentItem);
router.delete('/dh/create/item/:id', dhAnnualIndentController.deleteDhCreateIndentItem);
router.post('/dh/create/upload-excel', dhAnnualIndentController.uploadExcelDhIndentItems);
router.post('/dh/create/freeze', dhAnnualIndentController.freezeDhIndent);
router.delete('/dh/create/indent', dhAnnualIndentController.deleteDhIndent);

// ==========================================
// 3. AYUSH Upload & Forward Indent Routes (Delegated - Image 2)
// ==========================================
router.get('/ayush/upload-forward/fin-years', ayushAnnualIndentController.getAyushUploadForwardFinYears);
router.get('/ayush/categories', ayushAnnualIndentController.getAyushCategories);
router.get('/ayush/upload-forward/list', ayushAnnualIndentController.getAyushUploadForwardList);
router.get('/ayush/download-format', ayushAnnualIndentController.getAyushDownloadFormatData);
router.get('/ayush/pdf/items', ayushAnnualIndentController.getAyushIndentPdfItems);
router.get('/ayush/create/header', ayushAnnualIndentController.getAyushCreateIndentHeader);
router.post('/ayush/create/generate-header', ayushAnnualIndentController.generateAyushIndentHeader);
router.get('/ayush/create/items', ayushAnnualIndentController.getAyushCreateIndentItems);
router.put('/ayush/create/item', ayushAnnualIndentController.updateAyushCreateIndentItem);
router.delete('/ayush/create/item/:id', ayushAnnualIndentController.deleteAyushCreateIndentItem);
router.post('/ayush/create/upload-excel', ayushAnnualIndentController.uploadExcelAyushIndentItems);
router.post('/ayush/create/freeze', ayushAnnualIndentController.freezeAyushIndent);
router.delete('/ayush/create/indent', ayushAnnualIndentController.deleteAyushIndent);

// DAO (District AYUSH Officer) Routes
router.get('/dao/forwarded-list', ayushAnnualIndentController.getDaoForwardedList);
router.get('/dao/detail-items', ayushAnnualIndentController.getDaoDetailItems);
router.get('/dao/approval-list', ayushAnnualIndentController.getDaoApprovalList);
router.get('/dao/indent-items/:indentId', ayushAnnualIndentController.getDaoIndentItems);
router.post('/dao/approve', ayushAnnualIndentController.approveDaoIndent);
router.get('/dao/status-report', ayushAnnualIndentController.getDaoStatusReport);
router.get('/dao/item-wise-ai', ayushAnnualIndentController.getDaoItemWiseAi);

// ==========================================
// 4. Non-EDL Annual Indent Routes (Delegated)
// ==========================================
router.get('/non-edl/download-format', nonEdlAnnualIndentController.getDownloadNonEdlFormatData);
router.get('/non-edl/upload-forward/list', nonEdlAnnualIndentController.getNonEdlUploadForwardList);
router.get('/non-edl/create/fin-years', nonEdlAnnualIndentController.getNonEdlCreateFinYears);
router.get('/non-edl/create/header', nonEdlAnnualIndentController.getNonEdlCreateIndentHeader);
router.post('/non-edl/create/generate-header', nonEdlAnnualIndentController.generateNonEdlIndentHeader);
router.get('/non-edl/create/items', nonEdlAnnualIndentController.getNonEdlCreateIndentItems);
router.post('/non-edl/create/upload-excel', nonEdlAnnualIndentController.uploadExcelNonEdlIndentItems);
router.post('/non-edl/create/freeze', nonEdlAnnualIndentController.freezeNonEdlIndent);
router.delete('/non-edl/create/indent', nonEdlAnnualIndentController.deleteNonEdlIndent);

// ==========================================
// 5. Reagent Non-EDL Consumable & Kits Routes (Delegated)
// ==========================================
router.get('/reagent-non-edl/download-format', reagentNonEdlIndentController.getDownloadReagentNonEdlFormatData);
router.get('/reagent/upload-forward/list', reagentNonEdlIndentController.getReagentUploadForwardList);
router.get('/reagent/create/fin-years', reagentNonEdlIndentController.getReagentCreateFinYears);
router.get('/reagent/create/header', reagentNonEdlIndentController.getReagentCreateIndentHeader);
router.post('/reagent/create/generate-header', reagentNonEdlIndentController.generateReagentIndentHeader);
router.get('/reagent/create/items', reagentNonEdlIndentController.getReagentCreateIndentItems);
router.post('/reagent/create/upload-excel', reagentNonEdlIndentController.uploadExcelReagentIndentItems);
router.post('/reagent/create/freeze', reagentNonEdlIndentController.freezeReagentIndent);
router.delete('/reagent/create/indent', reagentNonEdlIndentController.deleteReagentIndent);

// ==========================================
// 6. Medical College AI Routes (Delegated)
// ==========================================
router.get('/medical-college-ai/dropdowns', medicalCollegeAiController.getMedicalCollegeAiDropdowns);
router.get('/medical-college-ai', medicalCollegeAiController.getMedicalCollegeAiReport);
router.get('/mc-ai-vs-issuance', medicalCollegeAiController.getMcHospitalAiVsIssuance);
router.get('/mc-ai-vs-issuance/dropdowns', medicalCollegeAiController.getMcAiVsIssuanceDropdowns);
router.get('/mc-ai-vs-issuance/report', medicalCollegeAiController.getMcAiVsIssuanceReport);

module.exports = router;
