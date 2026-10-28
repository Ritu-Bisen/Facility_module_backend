const express = require('express');
const router = express.Router();
const expiryVoucherController = require('../controllers/expiryVoucherController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/fin-years', expiryVoucherController.getFinancialYears);
router.get('/list', expiryVoucherController.getExpiryVoucherList);
router.get('/header', expiryVoucherController.getHeaderInfo);
router.post('/save-header', expiryVoucherController.saveHeader);
router.get('/items', expiryVoucherController.getItems);
router.post('/complete', expiryVoucherController.completeVoucher);
router.delete('/:issueId', expiryVoucherController.deleteVoucher);

module.exports = router;
