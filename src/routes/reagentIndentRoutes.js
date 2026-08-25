const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reagentIndentController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

// GET /api/reagent-indent/medical-colleges
router.get('/medical-colleges', ctrl.getMedicalColleges);

// GET /api/reagent-indent/freez-rc-details
router.get('/freez-rc-details', ctrl.getFreezRcDetails);

// GET /api/reagent-indent/warehouse-indent
router.get('/warehouse-indent', ctrl.getWarehouseIndents);

// GET /api/reagent-indent/check-incomplete
router.get('/check-incomplete', ctrl.checkIncompleteIndent);

// POST /api/reagent-indent/generate-header
router.post('/generate-header', ctrl.generateIndentHeader);

// GET /api/reagent-indent/facility-equipments
router.get('/facility-equipments', ctrl.getFacilityEquipments);

// GET /api/reagent-indent/make-models
router.get('/make-models', ctrl.getMakeModels);

// POST /api/reagent-indent/save-equipment
router.post('/save-equipment', ctrl.saveEquipment);

// GET /api/reagent-indent/items
router.get('/items', ctrl.getReagentItems);

// POST /api/reagent-indent/save-items
router.post('/save-items', ctrl.saveReagentItems);

// POST /api/reagent-indent/send-otp
router.post('/send-otp', ctrl.sendOtp);

// POST /api/reagent-indent/freeze
router.post('/freeze', ctrl.freezeIndent);

// DELETE /api/reagent-indent/delete/:indentId
router.delete('/delete/:indentId', ctrl.deleteIndent);

module.exports = router;
