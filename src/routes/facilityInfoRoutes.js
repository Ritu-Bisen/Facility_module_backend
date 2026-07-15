const express = require('express');
const router = express.Router();
const facilityInfoController = require('../controllers/facilityInfoController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.route('/')
  .get(facilityInfoController.getFacilityInfo)
  .post(facilityInfoController.saveFacilityInfo);

module.exports = router;
