const doctorInfoModel = require('../models/doctorInfoModel');
const { validateNameInput, validatePhoneInput } = require('../utils/sanitizer');

const doctorInfoController = {
  getDoctors: async (req, res, next) => {
    try {
      const facilityId = req.user.facilityId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const searchId = req.query.searchId || null;

      const doctors = await doctorInfoModel.getDoctors(facilityId, page, limit, searchId);
      res.json(doctors);
    } catch (error) {
      next(error);
    }
  },

  addDoctor: async (req, res, next) => {
    try {
      const facilityId = req.user.facilityId;
      const { drName, mobileNo } = req.body;
      
      const valName = validateNameInput(drName, 'Doctor Name');
      if (!valName.valid) {
        return res.status(400).json({ message: valName.message });
      }

      const valPhone = validatePhoneInput(mobileNo);
      if (!valPhone.valid) {
        return res.status(400).json({ message: valPhone.message });
      }

      await doctorInfoModel.addDoctor(facilityId, drName.trim(), (mobileNo || '').trim());
      res.status(201).json({ message: 'Doctor added successfully' });
    } catch (error) {
      next(error);
    }
  },

  updateDoctor: async (req, res, next) => {
    try {
      const { drId } = req.params;
      const facilityId = req.user.facilityId;
      const { drName, mobileNo } = req.body;

      const valName = validateNameInput(drName, 'Doctor Name');
      if (!valName.valid) {
        return res.status(400).json({ message: valName.message });
      }

      const valPhone = validatePhoneInput(mobileNo);
      if (!valPhone.valid) {
        return res.status(400).json({ message: valPhone.message });
      }

      await doctorInfoModel.updateDoctor(drId, drName.trim(), (mobileNo || '').trim(), facilityId);
      res.json({ message: 'Doctor updated successfully' });
    } catch (error) {
      next(error);
    }
  },

  deleteDoctor: async (req, res, next) => {
    try {
      const { drId } = req.params;
      try {
        await doctorInfoModel.deleteDoctor(drId);
        res.json({ message: 'Doctor deleted successfully' });
      } catch (err) {
        res.status(400).json({ message: 'Delete not allowed. References found.' });
      }
    } catch (error) {
      next(error);
    }
  }
};

module.exports = doctorInfoController;
