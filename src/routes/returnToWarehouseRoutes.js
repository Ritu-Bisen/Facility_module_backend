const express = require('express');
const router = express.Router();
const returnToWarehouseController = require('../controllers/returnToWarehouseController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/', authenticate, returnToWarehouseController.getReturnToWarehouseList);
router.get('/warehouses', authenticate, returnToWarehouseController.getWarehouses);
router.get('/:id', authenticate, returnToWarehouseController.getHeader);
router.post('/', authenticate, returnToWarehouseController.createHeader);
router.put('/:id', authenticate, returnToWarehouseController.updateHeader);
router.get('/:id/items', authenticate, returnToWarehouseController.getItems);
router.post('/:id/items', authenticate, returnToWarehouseController.addItem);
router.put('/items/:itemId', authenticate, returnToWarehouseController.updateItem);
router.delete('/items/:itemId', authenticate, returnToWarehouseController.deleteItem);
router.post('/:id/complete', authenticate, returnToWarehouseController.completeIssue);

module.exports = router;
