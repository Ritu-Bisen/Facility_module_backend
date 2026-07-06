const express = require('express');
const router = express.Router();
const { fetchShcIndents, getAccYears } = require('../controllers/shcIndentController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/fin-years', authenticate, getAccYears);
router.get('/', authenticate, fetchShcIndents);

module.exports = router;
