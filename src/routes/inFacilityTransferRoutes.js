const express = require('express');
const router = express.Router();
const inFacilityTransferController = require('../controllers/inFacilityTransferController');

// GET /api/in-facility-transfer/list
router.get('/list', inFacilityTransferController.getInFacilityTransferList);

// GET /api/in-facility-transfer/receipts-list
router.get('/receipts-list', inFacilityTransferController.getIncomingReceiptsList);

// GET /api/in-facility-transfer/facilities/:facilityId
router.get('/facilities/:facilityId', inFacilityTransferController.getFacilities);

// GET /api/in-facility-transfer/generate-issue-no
router.get('/generate-issue-no', inFacilityTransferController.generateIssueNo);

// GET /api/in-facility-transfer/items
router.get('/items', inFacilityTransferController.getItems);

// GET /api/in-facility-transfer/item-details
router.get('/item-details', inFacilityTransferController.getItemDetails);

// POST /api/in-facility-transfer/issue-item
router.post('/issue-item', inFacilityTransferController.saveIssueItem);

// DELETE /api/in-facility-transfer/issue-item/:issueItemId
router.delete('/issue-item/:issueItemId', inFacilityTransferController.deleteIssueItem);

// GET /api/in-facility-transfer/issue/:id
router.get('/issue/:id', inFacilityTransferController.getIssueById);

// PUT /api/in-facility-transfer/issue/:id
router.put('/issue/:id', inFacilityTransferController.updateIssueHeader);

// POST /api/in-facility-transfer/issue/:id/freeze
router.post('/issue/:id/freeze', inFacilityTransferController.freezeIssue);

module.exports = router;
