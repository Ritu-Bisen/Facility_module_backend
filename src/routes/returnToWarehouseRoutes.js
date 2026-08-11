const express = require('express');
const router = express.Router();
const returnToWarehouseController = require('../controllers/returnToWarehouseController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/', authenticate, returnToWarehouseController.getReturnToWarehouseList);

module.exports = router;
