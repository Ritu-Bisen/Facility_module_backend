const express = require('express');
const router = express.Router();
const localPurchaseController = require('../controllers/localPurchaseController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/budgets', authenticate, localPurchaseController.getBudgets);
router.get('/budget-details', authenticate, localPurchaseController.getBudgetDetails);
router.post('/budget-details', authenticate, localPurchaseController.addBudgetDetail);

// Suppliers
router.get('/suppliers', authenticate, localPurchaseController.getSuppliers);
router.get('/suppliers/:id', authenticate, localPurchaseController.getSupplierById);
router.post('/suppliers', authenticate, localPurchaseController.createSupplier);
router.put('/suppliers/:id', authenticate, localPurchaseController.updateSupplier);
router.delete('/suppliers/:id', authenticate, localPurchaseController.deleteSupplier);

// Supply Orders
router.get('/supply-orders', authenticate, localPurchaseController.getSupplyOrders);
router.get('/supply-orders/auto-number', authenticate, localPurchaseController.generateSupplyOrderNo);
router.post('/supply-orders', authenticate, localPurchaseController.saveSupplyOrderHeader);
router.get('/supply-orders/:id/pdf-details', authenticate, localPurchaseController.getSupplyOrderDetails);
router.get('/supply-orders/edit-details/:poNoId', authenticate, localPurchaseController.getSupplyOrderEditDetails);
router.get('/supply-orders/:poNoId', authenticate, localPurchaseController.getSupplyOrderDetails);
router.get('/supply-orders/:id/items', authenticate, localPurchaseController.getSupplyOrderItems);
router.post('/supply-orders/:id/items', authenticate, localPurchaseController.addSupplyOrderItem);
router.put('/supply-orders/:id/items/:itemId', authenticate, localPurchaseController.updateSupplyOrderItem);
router.delete('/supply-orders/:id/items/:itemId', authenticate, localPurchaseController.deleteSupplyOrderItem);
router.post('/supply-orders/:poNoId/complete', authenticate, localPurchaseController.completeSupplyOrder);
router.delete('/supply-orders/:poNoId', authenticate, localPurchaseController.deleteSupplyOrder);
router.post('/supply-orders/:poNoId/amend', authenticate, localPurchaseController.amendSupplyOrder);
router.get('/noc-details', authenticate, localPurchaseController.getNocDetails);
router.get('/noc-balance', authenticate, localPurchaseController.getNocBalance);

// Receipts from Supplier
router.get('/supplier-receipts', authenticate, localPurchaseController.getSupplierReceipts);

// Individual Receipt API
router.get('/receipts/header', authenticate, localPurchaseController.getReceiptHeaderData);
router.post('/receipts', authenticate, localPurchaseController.saveReceiptHeader);
router.get('/receipts/items', authenticate, localPurchaseController.getReceiptItems);
router.post('/receipts/:receiptId/items', authenticate, localPurchaseController.saveReceiptItems);
router.get('/receipts/:receiptId/batches', authenticate, localPurchaseController.getReceiptBatches);
router.post('/receipts/:receiptId/batches', authenticate, localPurchaseController.saveReceiptBatch);
router.delete('/receipts/batches/:inwNo', authenticate, localPurchaseController.deleteReceiptBatch);
router.post('/receipts/:receiptId/complete', authenticate, localPurchaseController.completeReceipt);

module.exports = router;
