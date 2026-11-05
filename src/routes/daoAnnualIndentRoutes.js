const express = require('express');
const router = express.Router();
const daoAnnualIndentController = require('../controllers/daoAnnualIndentController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

// Dropdowns
router.get('/fin-years', daoAnnualIndentController.getFinYears);
router.get('/categories', daoAnnualIndentController.getCategories);
router.get('/drugs', daoAnnualIndentController.getDrugs);

// Items Grid
router.get('/facility-items', daoAnnualIndentController.getFacilityItems);
router.post('/approve-item', daoAnnualIndentController.approveItem);
router.post('/approve-batch', daoAnnualIndentController.approveBatchItems);

// General Tab (Dispatch & Freeze)
router.get('/dispatch-details', daoAnnualIndentController.getDispatchDetails);
router.post('/dispatch-details', daoAnnualIndentController.saveDispatchDetails);
router.post('/freeze', daoAnnualIndentController.freezeIndent);

module.exports = router;
