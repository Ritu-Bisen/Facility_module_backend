const nocCancellationService = require('../services/nocCancellationService');

async function getNocsForCancellation(req, res, next) {
  try {
    const facilityId = req.user.facilityId;
    const data = await nocCancellationService.getNocsForCancellation(facilityId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getNocItemsForCancellation(req, res, next) {
  try {
    const { nocId } = req.params;
    const data = await nocCancellationService.getNocItemsForCancellation(nocId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function cancelNocItems(req, res, next) {
  try {
    const { srs } = req.body;
    const userId = req.user.id || req.user.userId; // adjust based on your auth middleware
    await nocCancellationService.cancelNocItems(srs, userId);
    res.json({ success: true, message: 'NOC items cancelled successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getNocsForCancellation,
  getNocItemsForCancellation,
  cancelNocItems
};
