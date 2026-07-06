const express = require('express');
const router = express.Router();
const warehouseReceiptController = require('../controllers/warehouseReceiptController');
// Assuming there is an auth middleware to protect routes and inject req.user
const { authenticate } = require('../middleware/authMiddleware');

router.get('/indents', authenticate, warehouseReceiptController.getWarehouseIndents);
router.get('/receipts/:indentId', authenticate, warehouseReceiptController.getReceiptsByIndent);
router.get('/fin-years', authenticate, warehouseReceiptController.getFinancialYears);
router.get('/view/:receiptId', authenticate, warehouseReceiptController.getReceiptDetails);
router.post('/view/:receiptId/items', authenticate, warehouseReceiptController.saveReceiptItem);
router.get('/locations', authenticate, warehouseReceiptController.getStockLocations);
router.get('/batches/:indentItemId', authenticate, warehouseReceiptController.getReceiptBatches);
router.post('/view/:receiptId/batches', authenticate, warehouseReceiptController.addBatch);
router.post('/complete/:receiptId', authenticate, warehouseReceiptController.completeReceipt);

module.exports = router;
