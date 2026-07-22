const express = require('express');
const router = express.Router();
const stockRegisterController = require('../controllers/stockRegisterController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/data', stockRegisterController.getStockRegister);
router.get('/items', stockRegisterController.getFacilityItems);

module.exports = router;
