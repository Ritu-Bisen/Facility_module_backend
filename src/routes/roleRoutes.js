const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', roleController.getRoles);
router.get('/:roleId/permissions', roleController.getRolePermissions);
router.post('/permissions/save', roleController.saveRolePermissions);

module.exports = router;
