const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');
const { authenticate } = require('../middleware/authMiddleware');

// Route for getting item details
router.get('/:itemId/details', authenticate, itemController.getItemDetails);

// Route for getting all drugs
router.get('/drugs', authenticate, itemController.getDrugs);

// Route for getting all item types
router.get('/types', authenticate, itemController.getItemTypes);

module.exports = router;
