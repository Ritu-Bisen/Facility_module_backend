const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const inFacilityReceiptController = require('../controllers/inFacilityReceiptController');

router.use(authenticate);

// GET /api/in-facility-receipt/header/:indentId
router.get('/header/:indentId', inFacilityReceiptController.getHeader);

// GET /api/in-facility-receipt/header-info/:facReceiptId
router.get('/header-info/:facReceiptId', inFacilityReceiptController.getHeaderInfo);

// POST /api/in-facility-receipt/header
router.post('/header', inFacilityReceiptController.saveHeader);

// GET /api/in-facility-receipt/items
router.get('/items', inFacilityReceiptController.getItems);

// POST /api/in-facility-receipt/items
router.post('/items', inFacilityReceiptController.saveItem);

// GET /api/in-facility-receipt/batches/:indentItemId
router.get('/batches/:indentItemId', inFacilityReceiptController.getBatches);

// POST /api/in-facility-receipt/complete/:facReceiptId
router.post('/complete/:facReceiptId', inFacilityReceiptController.completeReceipt);

// DELETE /api/in-facility-receipt/delete/:facReceiptId
router.delete('/delete/:facReceiptId', inFacilityReceiptController.deleteReceipt);

module.exports = router;
