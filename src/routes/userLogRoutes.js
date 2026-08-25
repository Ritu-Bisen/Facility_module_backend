const express = require('express');
const router = express.Router();
const userLogController = require('../controllers/userLogController');
const { authenticate } = require('../middleware/authMiddleware');

// POST /api/user-logs - Record a log (authenticated or public client logging)
router.post('/', userLogController.postLog);

// GET /api/user-logs - Query logs (Protected)
router.get('/', authenticate, userLogController.getLogs);

// GET /api/user-logs/:id - Get log details by ID (Protected)
router.get('/:id', authenticate, userLogController.getLogById);

module.exports = router;
