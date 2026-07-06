const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');

router.get('/current-stock-drug-wise', storeController.getCurrentStockDrugWise);
router.get('/facility-stock-item-wise', storeController.getFacilityStockItemWise);
router.get('/current-stock-batch-wise', storeController.getCurrentStockBatchWise);
router.get('/facility-stock-drug-wise', storeController.getFacilityStockDrugWise);
router.get('/warehouse-stock', storeController.getWarehouseStock);

module.exports = router;
