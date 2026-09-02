const facilityWardModel = require('../models/facilityWardModel');
const SaltedHash = require('../utils/saltedHash');
const { validateWardInput } = require('../utils/sanitizer');

exports.getWards = async (req, res, next) => {
  try {
    const facilityId = req.user.facilityId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const searchId = req.query.searchId || null;
    
    const wards = await facilityWardModel.getWards(facilityId, page, limit, searchId);
    res.json(wards);
  } catch (error) {
    next(error);
  }
};

exports.addWard = async (req, res, next) => {
  try {
    const facilityId = req.user.facilityId;
    const { WardCode, WardName, IsOPDEntry, Password } = req.body;
    
    const valResult = validateWardInput(WardCode, WardName);
    if (!valResult.valid) {
      return res.status(400).json({ message: valResult.message });
    }

    let pwdString = null;
    if (Password) {
      const sh = SaltedHash.create(Password);
      pwdString = `salt{${sh.salt}}hash{${sh.hash}}`;
    }

    await facilityWardModel.addWard(facilityId, WardCode.trim(), WardName.trim(), IsOPDEntry, pwdString);
    res.status(201).json({ message: 'Added Successfully' });
  } catch (error) {
    next(error);
  }
};

exports.updateWard = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { WardCode, WardName, IsOPDEntry, Password } = req.body;

    const valResult = validateWardInput(WardCode, WardName);
    if (!valResult.valid) {
      return res.status(400).json({ message: valResult.message });
    }

    let pwdString = null;
    if (Password) {
      const sh = SaltedHash.create(Password);
      pwdString = `salt{${sh.salt}}hash{${sh.hash}}`;
    }

    await facilityWardModel.updateWard(id, WardCode.trim(), WardName.trim(), IsOPDEntry, pwdString);
    res.json({ message: 'Updated Successfully' });
  } catch (error) {
    next(error);
  }
};

exports.deleteWard = async (req, res, next) => {
  try {
    const { id } = req.params;
    await facilityWardModel.deleteWard(id);
    res.json({ message: 'Deleted Successfully' });
  } catch (error) {
    if (error.message.includes('ORA-02292')) {
      return res.status(400).json({ message: 'Delete not allowed, references found' });
    }
    next(error);
  }
};
