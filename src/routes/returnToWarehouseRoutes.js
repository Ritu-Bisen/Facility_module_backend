const express = require('express');
const router = express.Router();
const returnToWarehouseController = require('../controllers/returnToWarehouseController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/', authenticate, returnToWarehouseController.getReturnToWarehouseList);
router.get('/warehouses', authenticate, returnToWarehouseController.getWarehouses);
router.get('/generate-issue-no', authenticate, returnToWarehouseController.generateIssueNo);
router.get('/incomplete', authenticate, returnToWarehouseController.getIncompleteIssue);
router.get('/facility-stock', authenticate, returnToWarehouseController.getFacilityStock);
router.get('/item-multiple/:itemId', authenticate, returnToWarehouseController.getItemMultiple);
router.get('/batches/:issueItemId/:itemId', authenticate, returnToWarehouseController.getBatchesForItem);
router.get('/header/:issueId', authenticate, returnToWarehouseController.getHeaderInfo);
router.get('/:issueId/items', authenticate, returnToWarehouseController.getIssueItems);

router.post('/', authenticate, returnToWarehouseController.createIssueHeader);
router.put('/:issueId', authenticate, returnToWarehouseController.updateIssueHeader);
router.delete('/:issueId', authenticate, returnToWarehouseController.deleteIssueHeader);

router.post('/:issueId/items', authenticate, returnToWarehouseController.addIssueItem);
router.put('/items/:issueItemId', authenticate, returnToWarehouseController.updateIssueItem);
router.delete('/items/:issueItemId', authenticate, returnToWarehouseController.deleteIssueItem);

router.post('/:issueId/complete', authenticate, returnToWarehouseController.completeIssue);

module.exports = router;

