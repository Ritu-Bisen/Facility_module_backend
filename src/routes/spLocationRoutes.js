const express = require('express');
const router = express.Router();
const spLocationController = require('../controllers/spLocationController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', spLocationController.getLocations);
router.post('/', spLocationController.addLocation);
router.put('/:id', spLocationController.updateLocation);
router.delete('/:id', spLocationController.deleteLocation);

module.exports = router;
