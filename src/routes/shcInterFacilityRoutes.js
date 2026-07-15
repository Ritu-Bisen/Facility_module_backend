const express = require('express');
const router = express.Router();
const controller = require('../controllers/shcInterFacilityController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/fin-years', authenticate, controller.getAccYears);
router.get('/', authenticate, controller.getTransfers);
router.get('/all-facilities', authenticate, controller.getAllFacilities);
router.get('/:nocId/header', authenticate, controller.getHeaderInfo);
router.post('/:nocId/issues', authenticate, controller.saveIssueHeader);
router.post('/direct-issues/:facilityId', authenticate, controller.generateDirectIssueNo);
router.get('/:nocId/items', authenticate, controller.getItems);
router.post('/issues/:issueId/items', authenticate, controller.saveIssueItem);
router.delete('/issues/items/:issueItemId', authenticate, controller.deleteIssueItem);
router.post('/issues/:issueId/complete', authenticate, controller.completeIssue);
router.delete('/issues/:issueId', authenticate, controller.deleteIssueHeader);

module.exports = router;
