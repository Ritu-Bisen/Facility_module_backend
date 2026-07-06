const express = require('express');
const router = express.Router();
const shcIndentItemController = require('../controllers/shcIndentItemController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/:nocId/header', authenticate, shcIndentItemController.getIndentHeader);
router.get('/:nocId/items', authenticate, shcIndentItemController.getIndentItems);
router.post('/approve', authenticate, shcIndentItemController.approveItem);
router.post('/complete/:nocId', authenticate, shcIndentItemController.completeIndent);

module.exports = router;
