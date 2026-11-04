const express = require('express');
const router = express.Router();
const ayushAnnualIndentController = require('../controllers/ayushAnnualIndentController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

// ==========================================
// 1. Ayush Upload & Forward Page Routes (Image 2)
// ==========================================
router.get('/upload-forward/fin-years', ayushAnnualIndentController.getAyushUploadForwardFinYears);
router.get('/categories', ayushAnnualIndentController.getAyushCategories);
router.get('/upload-forward/list', ayushAnnualIndentController.getAyushUploadForwardList);
router.get('/download-format', ayushAnnualIndentController.getAyushDownloadFormatData);
router.get('/pdf/items', ayushAnnualIndentController.getAyushIndentPdfItems);

// Ayush Create Indent Handlers
router.get('/create/header', ayushAnnualIndentController.getAyushCreateIndentHeader);
router.post('/create/generate-header', ayushAnnualIndentController.generateAyushIndentHeader);
router.get('/create/items', ayushAnnualIndentController.getAyushCreateIndentItems);
router.put('/create/item', ayushAnnualIndentController.updateAyushCreateIndentItem);
router.delete('/create/item/:id', ayushAnnualIndentController.deleteAyushCreateIndentItem);
router.post('/create/upload-excel', ayushAnnualIndentController.uploadExcelAyushIndentItems);
router.post('/create/freeze', ayushAnnualIndentController.freezeAyushIndent);
router.delete('/create/indent', ayushAnnualIndentController.deleteAyushIndent);

// ==========================================
// 2. DAO (District AYUSH Officer) Routes
// ==========================================
router.get('/dao/forwarded-list', ayushAnnualIndentController.getDaoForwardedList);
router.get('/dao/detail-items', ayushAnnualIndentController.getDaoDetailItems);
router.get('/dao/approval-list', ayushAnnualIndentController.getDaoApprovalList);
router.get('/dao/indent-items/:indentId', ayushAnnualIndentController.getDaoIndentItems);
router.post('/dao/approve', ayushAnnualIndentController.approveDaoIndent);
router.get('/dao/status-report', ayushAnnualIndentController.getDaoStatusReport);
router.get('/dao/item-wise-ai', ayushAnnualIndentController.getDaoItemWiseAi);

module.exports = router;
