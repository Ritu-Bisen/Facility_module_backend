const express = require('express');
const router = express.Router();
const ayushLocalPurchaseController = require('../controllers/ayushLocalPurchaseController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/', authenticate, ayushLocalPurchaseController.getAyushOrders);
router.get('/auto-number', authenticate, ayushLocalPurchaseController.generateAyushPoNo);
router.post('/', authenticate, ayushLocalPurchaseController.saveAyushHeader);
router.get('/:id', authenticate, ayushLocalPurchaseController.getAyushOrderDetails);
router.delete('/:id', authenticate, ayushLocalPurchaseController.deleteAyushOrder);
router.get('/:id/items', authenticate, ayushLocalPurchaseController.getAyushOrderItems);
router.post('/:id/items', authenticate, ayushLocalPurchaseController.addAyushOrderItem);
router.put('/:id/items/:itemId', authenticate, ayushLocalPurchaseController.updateAyushOrderItem);
router.delete('/:id/items/:itemId', authenticate, ayushLocalPurchaseController.deleteAyushOrderItem);
router.put('/:id/complete', authenticate, ayushLocalPurchaseController.completeAyushOrder);
router.post('/:id/amend', authenticate, ayushLocalPurchaseController.amendAyushOrder);

module.exports = router;
