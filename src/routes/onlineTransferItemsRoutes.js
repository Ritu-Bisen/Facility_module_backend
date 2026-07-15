const express = require('express');
const router = express.Router();
const controller = require('../controllers/onlineTransferItemsController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/header/noc/:nocId', controller.getIndentHeader);
router.get('/header/issue/:issueId', controller.getIssueHeader);
router.post('/header', controller.createIssueHeader);
router.put('/header/:issueId', controller.updateIssueHeader);
router.get('/items/issue/:issueId/noc/:nocId', controller.getItemsForIssue);

module.exports = router;
