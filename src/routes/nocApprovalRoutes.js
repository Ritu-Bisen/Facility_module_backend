const express = require('express');
const router = express.Router();
const nocApprovalController = require('../controllers/nocApprovalController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/pending', nocApprovalController.getPendingNocItems);
router.post('/approve', nocApprovalController.approveNocItems);
router.post('/reject', nocApprovalController.rejectNocItems);
router.get('/facility-stock/:itemId', nocApprovalController.getFacilityWiseCurrentStock);

module.exports = router;
