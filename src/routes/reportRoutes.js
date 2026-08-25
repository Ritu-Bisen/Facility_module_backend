const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/short-expiry', authenticate, reportController.getShortExpiryReport);
router.get('/hold-batches', authenticate, reportController.getHoldBatches);
router.get('/cgmsc-receipt-drug-wise/dropdowns', authenticate, reportController.getCgmscDrugWiseDropdowns);
router.get('/cgmsc-receipt-drug-wise/items', authenticate, reportController.getItemsByCategory);
router.get('/cgmsc-receipt-drug-wise', authenticate, reportController.getCgmscReceiptDrugWise);
router.get('/cgmsc-receipt-batch-wise', authenticate, reportController.getCgmscReceiptBatchWise);
router.get('/date-wise-facility-issue/dropdowns', authenticate, reportController.getDateWiseFacilityDropdowns);
router.get('/date-wise-facility-issue', authenticate, reportController.getDateWiseFacilityIssue);

module.exports = router;
