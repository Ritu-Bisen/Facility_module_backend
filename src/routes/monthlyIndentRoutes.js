const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/monthlyIndentController');
const { authenticate } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authenticate);

// ─── Header routes ────────────────────────────────────────────────────────────

// GET  /api/monthly-indent/programs
router.get('/programs', ctrl.getPrograms);

// GET  /api/monthly-indent/item-categories
router.get('/item-categories', ctrl.getItemCategories);

// GET  /api/monthly-indent/item-types
router.get('/item-types', ctrl.getItemTypes);

// GET  /api/monthly-indent/list?accYrSetId=&status=
router.get('/list', ctrl.getNocList);

// GET  /api/monthly-indent/incomplete
router.get('/incomplete', ctrl.getIncompleteNoc);

// POST  /api/monthly-indent/generate-no
router.post('/generate-no', ctrl.generateNocNumber);

// POST /api/monthly-indent/
router.post('/', ctrl.createNoc);

// ─── Item routes (must come before /:nocId) ───────────────────────────────────

// GET  /api/monthly-indent/fm-items
router.get('/fm-items', ctrl.getFmItems);

// GET  /api/monthly-indent/warehouse-items
router.get('/warehouse-items', ctrl.getWarehouseItems);

// GET  /api/monthly-indent/dhs-indent-items
router.get('/dhs-indent-items', ctrl.getDhsIndentItems);

// GET  /api/monthly-indent/against-approval-indent
router.get('/against-approval-indent', ctrl.getAgainstApprovalIndentItems);

// GET  /api/monthly-indent/other-item
router.get('/other-item', ctrl.getOtherItem);

// PUT    /api/monthly-indent/items/:nocItemId
router.put('/items/:nocItemId', ctrl.updateNocItem);

// DELETE /api/monthly-indent/items/:nocItemId
router.delete('/items/:nocItemId', ctrl.deleteNocItem);

// ─── Per-NOC routes ───────────────────────────────────────────────────────────

// GET    /api/monthly-indent/:nocId
router.get('/:nocId', ctrl.getNocById);

// PUT    /api/monthly-indent/:nocId
router.put('/:nocId', ctrl.updateNoc);

// DELETE /api/monthly-indent/:nocId
router.delete('/:nocId', ctrl.deleteNoc);

// POST   /api/monthly-indent/:nocId/complete
router.post('/:nocId/complete', ctrl.completeNoc);

// GET    /api/monthly-indent/:nocId/check
router.get('/:nocId/check', ctrl.checkNocIndent);

// GET    /api/monthly-indent/:nocId/items
router.get('/:nocId/items', ctrl.getNocItems);

// POST   /api/monthly-indent/:nocId/items
router.post('/:nocId/items', ctrl.saveNocItem);

module.exports = router;
