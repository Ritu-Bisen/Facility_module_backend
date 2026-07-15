const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/indentToOtherFacilityController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/',                         ctrl.getIndents);
router.post('/',                        ctrl.createIndent);
router.get('/items',                    ctrl.getItemsForFacility);
router.get('/:indentId',               ctrl.getIndentDetail);
router.put('/:indentId',                ctrl.updateIndent);
router.delete('/:indentId',             ctrl.deleteIndent);
router.post('/:indentId/complete',      ctrl.completeIndent);
router.post('/:indentId/items',         ctrl.saveIndentItem);
router.put('/:indentId/items/:itemId',  ctrl.editIndentItem);
router.delete('/:indentId/items/:itemId', ctrl.deleteIndentItem);

module.exports = router;
