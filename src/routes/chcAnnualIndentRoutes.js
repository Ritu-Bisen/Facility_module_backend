const express = require('express');
const router = express.Router();
const chcAnnualIndentController = require('../controllers/chcAnnualIndentController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

// Financial Years
router.get('/fin-years', chcAnnualIndentController.getFinYears);

// Drugs dropdown
router.get('/drugs', chcAnnualIndentController.getDrugs);

// Items for selected drug
router.get('/items', chcAnnualIndentController.getFacilityItems);

// Approve single item
router.post('/approve', chcAnnualIndentController.approveItem);

// Approve batch items
router.post('/approve-batch', chcAnnualIndentController.approveBatchItems);

// Dispatch details
router.get('/dispatch-details', chcAnnualIndentController.getDispatchDetails);
router.post('/save-dispatch', chcAnnualIndentController.saveDispatchDetails);

// Freeze
router.post('/freeze', chcAnnualIndentController.freezeIndent);

module.exports = router;
