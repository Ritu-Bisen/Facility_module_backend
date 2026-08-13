const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/', authenticate, contractController.getContracts);
router.get('/tenders', authenticate, contractController.getTenders);

// Fin Years & Tenders Full CRUD
router.get('/supply-order', authenticate, contractController.getContractsForSO);
router.get('/fin-years', authenticate, contractController.getFinYears);
router.get('/local-items', authenticate, contractController.getLocalItems);
router.get('/tenders/list', authenticate, contractController.getTendersList);
router.post('/tenders', authenticate, contractController.createTender);
router.put('/tenders/:id', authenticate, contractController.updateTender);
router.delete('/tenders/:id', authenticate, contractController.deleteTender);

// Contract Headers
router.get('/:id', authenticate, contractController.getContractById);
router.post('/', authenticate, contractController.createContract);
router.put('/:id', authenticate, contractController.updateContract);
router.put('/:id/complete', authenticate, contractController.completeContract);
router.put('/:id/amend', authenticate, contractController.amendContract);

// Contract Items
router.get('/:id/items', authenticate, contractController.getContractItems);
router.post('/:id/items', authenticate, contractController.addContractItem);
router.put('/items/:itemId', authenticate, contractController.updateContractItem);
router.delete('/items/:itemId', authenticate, contractController.deleteContractItem);

module.exports = router;
