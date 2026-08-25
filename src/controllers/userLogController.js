const userLogModel = require('../models/userLogModel');
const logger = require('../utils/logger');

/**
 * POST /api/user-logs
 * Post a custom log entry to USERS_LOGS
 */
async function postLog(req, res, next) {
  try {
    const logData = req.body || {};
    
    // Default from req.user / headers if not present in body
    if (!logData.userId && req.user) logData.userId = req.user.userId;
    if (!logData.userRole && req.user) logData.userRole = req.user.role;
    if (!logData.roleId && req.user) logData.roleId = req.user.roleId;
    if (!logData.facilities && req.user) logData.facilities = req.user.facilityId;
    if (!logData.ipAddress) logData.ipAddress = req.headers['x-forwarded-for'] || req.ip || '127.0.0.1';
    if (!logData.systemType) logData.systemType = req.headers['user-agent'] || 'Web';

    // Currently commented out as requested
    // await userLogModel.insertLog(logData);

    return res.status(201).json({
      success: true,
      message: 'Log recording currently disabled'
    });
  } catch (error) {
    logger.error('Error posting user log: ' + error.message);
    next(error);
  }
}

/**
 * GET /api/user-logs
 * Fetch logs with optional filtering & pagination
 */
async function getLogs(req, res, next) {
  try {
    const { userId, action, logCategory, limit, offset } = req.query;

    const logs = await userLogModel.getLogs({
      userId,
      action,
      logCategory,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0
    });

    return res.status(200).json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    logger.error('Error fetching user logs: ' + error.message);
    next(error);
  }
}

/**
 * GET /api/user-logs/:id
 * Fetch a specific log entry by ID
 */
async function getLogById(req, res, next) {
  try {
    const { id } = req.params;
    const log = await userLogModel.getLogById(id);

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Log entry not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: log
    });
  } catch (error) {
    logger.error('Error fetching log by ID: ' + error.message);
    next(error);
  }
}

module.exports = {
  postLog,
  getLogs,
  getLogById
};
