const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/me/info', authenticate, userController.getMyInfo);
router.get('/me/menus', authenticate, userController.getMyMenus);
router.get('/', authenticate, userController.getUsers);
router.get('/:id', authenticate, userController.getUser);

module.exports = router;
