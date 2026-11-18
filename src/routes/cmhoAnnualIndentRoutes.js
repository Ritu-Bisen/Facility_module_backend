const express = require('express');
const router = express.Router();
const cmhoAnnualIndentController = require('../controllers/cmhoAnnualIndentController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

// Financial Years dropdown (accyrsetid > 534)
router.get('/fin-years', cmhoAnnualIndentController.getFinYears);

// Status Report of District Health Facilities
router.get('/status-report', cmhoAnnualIndentController.getStatusReport);

module.exports = router;
