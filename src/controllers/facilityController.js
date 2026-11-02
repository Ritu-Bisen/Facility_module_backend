const facilityModel = require('../models/facilityModel');
const logger = require('../utils/logger');

async function getItems(req, res) {
  try {
    const { facilityId } = req.params;
    const { inStockOnly } = req.query;
    if (!facilityId) {
      return res.status(400).json({ error: "facilityId is required" });
    }
    const items = await facilityModel.getItems(facilityId, inStockOnly === 'true' || inStockOnly === true);
    res.json(items);
  } catch (error) {
    logger.error('Error in getItems controller: ' + error.message);
    res.status(500).json({ error: error.message });
  }
}

async function getDistrictId(req, res) {
  try {
    const facilityId = req.params.facilityId || req.query.facilityId || req.user?.facilityId;
    if (!facilityId) {
      return res.status(400).json({ success: false, error: "facilityId is required" });
    }
    const db = require('../config/db');
    const oracledb = require('oracledb');
    const result = await db.execute(
      'SELECT DISTRICTID FROM MASFACILITIES WHERE FACILITYID = :facilityId',
      { facilityId: Number(facilityId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const districtId = result.rows && result.rows[0] ? (result.rows[0].DISTRICTID || result.rows[0].districtid) : null;
    res.json({ success: true, districtId: districtId !== null && districtId !== undefined ? Number(districtId) : null });
  } catch (error) {
    logger.error('Error in getDistrictId controller: ' + error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getItems,
  getDistrictId
};
