const express = require('express');
const router = express.Router();
const controller = require('../controllers/interFacilityIssueOnlineController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', controller.getIndentsForIssue);
router.get('/:indentId/issues', controller.getIssuesForIndent);

module.exports = router;
