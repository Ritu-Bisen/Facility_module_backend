const spLocationModel = require('../models/spLocationModel');

const spLocationController = {
  getLocations: async (req, res, next) => {
    try {
      const facilityId = req.user.facilityId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const searchId = req.query.searchId || null;

      const locations = await spLocationModel.getLocations(facilityId, page, limit, searchId);
      res.json(locations);
    } catch (error) {
      next(error);
    }
  },

  addLocation: async (req, res, next) => {
    try {
      const facilityId = req.user.facilityId;
      const { locationno } = req.body;
      
      if (!locationno) {
        return res.status(400).json({ message: 'Location Name is required' });
      }

      await spLocationModel.addLocation(facilityId, locationno);
      res.status(201).json({ message: 'Location added successfully' });
    } catch (error) {
      next(error);
    }
  },

  updateLocation: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { locationno } = req.body;

      if (!locationno) {
        return res.status(400).json({ message: 'Location Name is required' });
      }

      await spLocationModel.updateLocation(id, locationno);
      res.json({ message: 'Location updated successfully' });
    } catch (error) {
      next(error);
    }
  },

  deleteLocation: async (req, res, next) => {
    try {
      const { id } = req.params;
      try {
        await spLocationModel.deleteLocation(id);
        res.json({ message: 'Location deleted successfully' });
      } catch (err) {
        res.status(400).json({ message: 'Delete not allowed. References found.' });
      }
    } catch (error) {
      next(error);
    }
  }
};

module.exports = spLocationController;
