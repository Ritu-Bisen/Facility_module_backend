const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const openingStockController = require('../controllers/openingStockController');

router.use(authenticate);

// List & Check
router.get('/list', openingStockController.getOpeningStockList);
router.get('/', openingStockController.getOpeningStockList);
router.get('/check', openingStockController.checkOpeningStockExists);

// Masters Dropdowns
router.get('/categories', openingStockController.getCategories);
router.get('/items', openingStockController.getItemsByCategory);
router.get('/locations', openingStockController.getStorageLocations);

// Header Info
router.get('/header', openingStockController.getHeaderInfo);
router.post('/header/update', openingStockController.updateHeaderInfo);

// Batches & Records
router.get('/batches', openingStockController.getOpeningStockBatches);
router.post('/save-batch', openingStockController.saveOpeningStockBatch);
router.delete('/delete-batch/:inwNo/:receiptItemId', openingStockController.deleteOpeningStockBatch);

// Freeze Action
router.post('/freeze', openingStockController.freezeOpeningStock);

module.exports = router;
