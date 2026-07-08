const express = require('express');
const router = express.Router();
const breakageVoucherController = require('../controllers/breakageVoucherController');

// GET /api/breakage-voucher/list
router.get('/list', breakageVoucherController.getBreakageVoucherList);

// Header routes
router.get('/generate-issue-no', breakageVoucherController.generateIssueNo);
router.get('/:id', breakageVoucherController.getHeaderInfo);
router.post('/', breakageVoucherController.saveHeaderInfo);
router.put('/:id', breakageVoucherController.saveHeaderInfo);

// Item routes
router.post('/:id/items', breakageVoucherController.saveBreakageItem);
router.put('/items/:id', breakageVoucherController.updateBreakageItem);

// Batch routes
router.get('/batches/available', breakageVoucherController.getAvailableBatches);
router.post('/batches/allocations', breakageVoucherController.saveBatchAllocations);

module.exports = router;
