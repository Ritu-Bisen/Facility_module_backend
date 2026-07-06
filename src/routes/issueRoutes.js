const express = require('express');
const router = express.Router();
const issueController = require('../controllers/issueController');

// GET /api/issues/generate-number/:facilityId
router.get('/generate-number/:facilityId', issueController.generateIssueNumber);

// POST /api/issues/generate-and-save/:facilityId
router.post('/generate-and-save/:facilityId', issueController.generateAndSaveIssue);

module.exports = router;
