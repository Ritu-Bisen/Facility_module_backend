const express = require('express');
const router = express.Router();
const annualIndentController = require('../controllers/annualIndentController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/items', annualIndentController.getItems);
router.get('/summary', annualIndentController.getSummary);
router.get('/distributions', annualIndentController.getDistributions);
router.post('/distribute', annualIndentController.updateDistribution);
router.delete('/distribute/:id', annualIndentController.deleteDistribution);

module.exports = router;
