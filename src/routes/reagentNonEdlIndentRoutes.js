const express = require('express');
const router = express.Router();
const reagentNonEdlIndentController = require('../controllers/reagentNonEdlIndentController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

// Download Reagent Non-EDL AI Format
router.get('/download-format', reagentNonEdlIndentController.getDownloadReagentNonEdlFormatData);

// Upload & Forward Reagent
router.get('/upload-forward/list', reagentNonEdlIndentController.getReagentUploadForwardList);

// Create / Edit Reagent Indent
router.get('/create/fin-years', reagentNonEdlIndentController.getReagentCreateFinYears);
router.get('/create/header', reagentNonEdlIndentController.getReagentCreateIndentHeader);
router.post('/create/generate-header', reagentNonEdlIndentController.generateReagentIndentHeader);
router.get('/create/items', reagentNonEdlIndentController.getReagentCreateIndentItems);
router.post('/create/upload-excel', reagentNonEdlIndentController.uploadExcelReagentIndentItems);
router.post('/create/freeze', reagentNonEdlIndentController.freezeReagentIndent);
router.delete('/create/indent', reagentNonEdlIndentController.deleteReagentIndent);

module.exports = router;
