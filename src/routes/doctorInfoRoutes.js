const express = require('express');
const router = express.Router();
const doctorInfoController = require('../controllers/doctorInfoController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', doctorInfoController.getDoctors);
router.post('/', doctorInfoController.addDoctor);
router.put('/:drId', doctorInfoController.updateDoctor);
router.delete('/:drId', doctorInfoController.deleteDoctor);

module.exports = router;
