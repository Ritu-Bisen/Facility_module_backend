const express = require('express');
const router = express.Router();
const facilityWardController = require('../controllers/facilityWardController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.route('/')
  .get(facilityWardController.getWards)
  .post(facilityWardController.addWard);

router.route('/:id')
  .put(facilityWardController.updateWard)
  .delete(facilityWardController.deleteWard);

module.exports = router;
