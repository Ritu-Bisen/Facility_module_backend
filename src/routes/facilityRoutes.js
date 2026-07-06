const express = require('express');
const router = express.Router();
const facilityController = require('../controllers/facilityController');
const { authenticate } = require('../middleware/authMiddleware');

// Route for getting items of a facility
router.get('/items/:facilityId', authenticate, facilityController.getItems);

module.exports = router;
