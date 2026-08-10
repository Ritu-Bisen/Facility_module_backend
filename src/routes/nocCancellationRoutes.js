const express = require('express');
const router = express.Router();
const nocCancellationController = require('../controllers/nocCancellationController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', nocCancellationController.getNocsForCancellation);
router.get('/:nocId/items', nocCancellationController.getNocItemsForCancellation);
router.post('/cancel', nocCancellationController.cancelNocItems);

module.exports = router;
