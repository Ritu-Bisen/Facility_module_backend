const storageLocationModel = require('../models/storageLocationModel');

const storageLocationController = {
  getLocations: async (req, res, next) => {
    try {
      const facilityId = req.user.facilityId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const searchId = req.query.searchId || null;

      const locations = await storageLocationModel.getLocations(facilityId, page, limit, searchId);
      res.json(locations);
    } catch (error) {
      next(error);
    }
  },

  addLocation: async (req, res, next) => {
    try {
      const facilityId = req.user.facilityId;
      const userId = req.user.userId;
      const { locationno } = req.body;
      
      if (!locationno) {
        return res.status(400).json({ message: 'Location No is required' });
      }

      await storageLocationModel.addLocation(facilityId, userId, locationno);
      res.status(201).json({ message: 'Location added successfully' });
    } catch (error) {
      next(error);
    }
  },

  updateLocation: async (req, res, next) => {
    try {
      const { rackId } = req.params;
      const userId = req.user.userId;
      const { locationno } = req.body;

      if (!locationno) {
        return res.status(400).json({ message: 'Location No is required' });
      }

      await storageLocationModel.updateLocation(rackId, locationno, userId);
      res.json({ message: 'Location updated successfully' });
    } catch (error) {
      next(error);
    }
  },

  deleteLocation: async (req, res, next) => {
    try {
      const { rackId } = req.params;
      try {
        await storageLocationModel.deleteLocation(rackId);
        res.json({ message: 'Location deleted successfully' });
      } catch (err) {
        // Oracle error code for integrity constraint violation is typically ORA-02292
        res.status(400).json({ message: 'Delete not allowed. References found.' });
      }
    } catch (error) {
      next(error);
    }
  }
};

module.exports = storageLocationController;
