const express = require('express');
const router = express.Router();
const wardIssueController = require('../controllers/wardIssueController');
const { authenticate } = require('../middleware/authMiddleware');

// Require authentication for all ward issue routes
router.use(authenticate);

// Wards dropdown
router.get('/wards', wardIssueController.getWards);

// Generate Issue No
router.get('/generate-issue-no', wardIssueController.generateIssueNo);

// Acc Years & Stock Check
router.get('/acc-years', wardIssueController.getAccYears);
router.get('/opening-stock-check', wardIssueController.checkOpeningStock);
router.get('/list', wardIssueController.getWardIssuesList);
router.get('/returns-wards', wardIssueController.getReturnsWards);
router.get('/returns-receipts', wardIssueController.getReturnsReceiptsList);

// Items dropdown (facility stock based)
router.get('/items', wardIssueController.getItems);

// Master items from masItems table
// GET /api/ward-issue/mas-items
router.get('/mas-items', wardIssueController.getMasItems);

// Facility stock for a specific item
// GET /api/ward-issue/facility-stock?facilityId=123&itemId=456
router.get('/facility-stock', wardIssueController.getFacilityStock);

// Header info
router.get('/incomplete', wardIssueController.getIncompleteIssue);
router.get('/:id', wardIssueController.getHeaderInfo);
router.post('/', wardIssueController.saveHeaderInfo);
router.put('/:id', wardIssueController.saveHeaderInfo); // same controller logic handles insert/update

// Issue items
router.get('/:id/items', wardIssueController.getIssueItems);
router.post('/:id/items', wardIssueController.saveIssueItem);
router.put('/items/:issueItemId', wardIssueController.updateIssueItem);
router.delete('/items/:issueItemId', wardIssueController.deleteIssueItem);
// Actions
router.post('/:id/complete', wardIssueController.completeIssue);
router.delete('/:id', wardIssueController.deleteIssue);
router.get('/batches/:issueItemId/:itemId', wardIssueController.getBatches);
router.get('/:id/print', wardIssueController.getPrintDetails);

module.exports = router;
