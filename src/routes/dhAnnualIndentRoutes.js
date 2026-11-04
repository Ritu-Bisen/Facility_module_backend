const express = require('express');
const router = express.Router();
const dhAnnualIndentController = require('../controllers/dhAnnualIndentController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

// Financial Years for DH Upload & Forward Page (Image 1)
router.get('/upload-forward/fin-years', dhAnnualIndentController.getDhUploadForwardFinYears);

// Indent List for DH Upload & Forward Page (Image 1)
router.get('/upload-forward/list', dhAnnualIndentController.getDhUploadForwardList);
router.get('/download-format', dhAnnualIndentController.getDhDownloadFormatData);
router.get('/pdf/items', dhAnnualIndentController.getDhIndentPdfItems);

// Create / Edit DH Indent Handlers
router.get('/create/header', dhAnnualIndentController.getDhCreateIndentHeader);
router.post('/create/generate-header', dhAnnualIndentController.generateDhIndentHeader);
router.get('/create/items', dhAnnualIndentController.getDhCreateIndentItems);
router.put('/create/item', dhAnnualIndentController.updateDhCreateIndentItem);
router.delete('/create/item/:id', dhAnnualIndentController.deleteDhCreateIndentItem);
router.post('/create/upload-excel', dhAnnualIndentController.uploadExcelDhIndentItems);
router.post('/create/freeze', dhAnnualIndentController.freezeDhIndent);
router.delete('/create/indent', dhAnnualIndentController.deleteDhIndent);

module.exports = router;
