const express = require('express');
const router = express.Router();
const storageLocationController = require('../controllers/storageLocationController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', storageLocationController.getLocations);
router.post('/', storageLocationController.addLocation);
router.put('/:rackId', storageLocationController.updateLocation);
router.delete('/:rackId', storageLocationController.deleteLocation);

module.exports = router;
