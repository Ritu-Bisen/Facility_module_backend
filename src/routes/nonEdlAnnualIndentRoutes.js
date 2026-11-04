const express = require('express');
const router = express.Router();
const nonEdlAnnualIndentController = require('../controllers/nonEdlAnnualIndentController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

// Download Non-EDL AI Format
router.get('/download-format', nonEdlAnnualIndentController.getDownloadNonEdlFormatData);

// Upload & Forward Non-EDL
router.get('/upload-forward/list', nonEdlAnnualIndentController.getNonEdlUploadForwardList);

// Create / Edit Non-EDL Indent
router.get('/create/fin-years', nonEdlAnnualIndentController.getNonEdlCreateFinYears);
router.get('/create/header', nonEdlAnnualIndentController.getNonEdlCreateIndentHeader);
router.post('/create/generate-header', nonEdlAnnualIndentController.generateNonEdlIndentHeader);
router.get('/create/items', nonEdlAnnualIndentController.getNonEdlCreateIndentItems);
router.post('/create/upload-excel', nonEdlAnnualIndentController.uploadExcelNonEdlIndentItems);
router.post('/create/freeze', nonEdlAnnualIndentController.freezeNonEdlIndent);
router.delete('/create/indent', nonEdlAnnualIndentController.deleteNonEdlIndent);

module.exports = router;
