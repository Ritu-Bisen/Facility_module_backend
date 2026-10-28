const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const specialReceiptController = require('../controllers/specialReceiptController');

router.use(authenticate);

// List & Masters
router.get('/list', specialReceiptController.getSpecialReceiptsList);
router.get('/', specialReceiptController.getSpecialReceiptsList);
router.get('/locations', specialReceiptController.getSpLocations);
router.get('/storage-locations', specialReceiptController.getStorageLocations);
router.get('/search-items', specialReceiptController.searchItems);

// Header Info
router.get('/header', specialReceiptController.getHeaderInfo);
router.post('/header', specialReceiptController.updateHeaderInfo);

// Items & Batches
router.get('/items', specialReceiptController.getReceiptItems);
router.post('/item', specialReceiptController.saveReceiptItem);
router.delete('/item/:receiptItemId', specialReceiptController.deleteReceiptItem);

router.post('/batch', specialReceiptController.saveBatch);
router.put('/batch/:inwNo', specialReceiptController.updateBatch);
router.delete('/batch/:inwNo', specialReceiptController.deleteBatch);

// General & Freeze
router.post('/general', specialReceiptController.saveGeneral);
router.post('/freeze', specialReceiptController.freezeReceipt);

module.exports = router;
