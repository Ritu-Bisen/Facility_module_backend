const facilityInfoModel = require('../models/facilityInfoModel');

exports.getFacilityInfo = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const info = await facilityInfoModel.getFacilityInfo(userId);
    res.json(info || {});
  } catch (error) {
    next(error);
  }
};

exports.saveFacilityInfo = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { header1, header2, header3, footer1, footer2, footer3, drMobile, drName, email } = req.body;
    
    if (!header1 || !header2 || !header3 || !footer1 || !footer2 || !footer3 || !drName || !drMobile) {
      return res.status(400).json({ message: 'All required fields must be filled' });
    }

    await facilityInfoModel.saveFacilityInfo(userId, {
      header1, header2, header3, footer1, footer2, footer3, drMobile, drName, email
    });
    res.json({ message: 'Health Facility Information Saved Successfully.' });
  } catch (error) {
    next(error);
  }
};
