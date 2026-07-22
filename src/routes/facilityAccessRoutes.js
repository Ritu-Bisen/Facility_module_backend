const express = require('express');
const router = express.Router();
const facilityAccessController = require('../controllers/facilityAccessController');
const { authenticate } = require('../middleware/authMiddleware');

// Base route: /api/facility-access
router.use(authenticate);

// Init table endpoint (can be called once manually by admin)
router.get('/init-table', facilityAccessController.initTable);

router.get('/my-menus', facilityAccessController.getMyMenus);
router.get('/modules', facilityAccessController.getNewModulesAndScreens);
router.post('/save', facilityAccessController.saveFacilityPermissions);

// Get all facility types (must be before /:facilityType to avoid param matching)
router.get('/types', facilityAccessController.getAllFacilityTypes);

// Get permissions for a specific facility type
router.get('/:facilityType', facilityAccessController.getPermissionsByFacility);

module.exports = router;
