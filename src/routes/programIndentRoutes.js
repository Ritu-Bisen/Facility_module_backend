const express = require('express');
const router = express.Router();
const controller = require('../controllers/programIndentController');

router.get('/programs', controller.getPrograms);
router.get('/fin-years', controller.getFinYears);
router.get('/list', controller.getProgramIndentList);
router.get('/header', controller.getProgramIndentHeader);
router.post('/generate-header', controller.generateProgramIndentHeader);
router.put('/update-header', controller.updateProgramIndentHeader);
router.delete('/header/:indentId', controller.deleteProgramIndent);
router.get('/items-dropdown', controller.getItemsDropdown);
router.get('/items', controller.getProgramIndentItems);
router.post('/save-item', controller.saveProgramIndentItem);
router.post('/save-bulk-items', controller.saveBulkProgramIndentItems);
router.delete('/item/:anualIndentId', controller.deleteProgramIndentItem);
router.post('/freeze', controller.freezeProgramIndent);

module.exports = router;
