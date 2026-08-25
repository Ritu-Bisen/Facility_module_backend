const { insertLog } = require('../models/userLogModel');

/**
 * Determine device type from User-Agent string.
 */
function parseDeviceType(userAgent) {
  if (!userAgent) return 'Unknown';
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(ua)) {
    return 'Mobile';
  } else if (/tablet|ipad/i.test(ua)) {
    return 'Tablet';
  }
  return 'Desktop';
}

/**
 * Express middleware to automatically log each request to USERS_LOGS table.
 */
function logActivityMiddleware(req, res, next) {
  // Capture start time if needed
  const startTime = Date.now();

  // Listen for the response to finish
  res.on('finish', () => {
    // Run log insertion asynchronously so HTTP response is never blocked
    setImmediate(async () => {
      try {
        const userAgent = req.headers['user-agent'] || '';
        const systemType = req.headers['x-system-type'] || 'facilitymodule';
        const deviceType = req.headers['x-device-type'] || parseDeviceType(userAgent);

        // Extract client IP address
        let ipAddress = req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || '127.0.0.1';
        if (typeof ipAddress === 'string' && ipAddress.includes(',')) {
          ipAddress = ipAddress.split(',')[0].trim();
        }
        if (ipAddress.startsWith('::ffff:')) {
          ipAddress = ipAddress.replace('::ffff:', '');
        }

        // Extract user context (from auth token or request body)
        const userId = req.user?.userId || req.user?.id || req.body?.userId || req.body?.USER_ID || null;
        const userRole = req.user?.role || req.user?.userRole || req.body?.userRole || req.body?.USER_ROLE || null;
        const roleId = req.user?.roleId || req.body?.roleId || req.body?.ROLEID || null;
        const facilities = req.headers['facility-id'] || req.user?.facilityId || req.body?.facilityId || req.body?.facilities || null;

        // Route & Action
        const method = req.method;
        const apiEndpoint = req.originalUrl || req.url;
        const route = req.baseUrl || req.path || '/';
        const action = req.headers['x-action'] || req.body?.action || method;

        // Category determination
        let logCategory = 'API_REQUEST';
        if (apiEndpoint.includes('/auth')) {
          logCategory = 'AUTH';
        } else if (apiEndpoint.includes('/reports')) {
          logCategory = 'REPORT';
        } else if (res.statusCode >= 400) {
          logCategory = 'ERROR';
        }

        // Description
        const description = req.logDescription || `${method} request to ${apiEndpoint} (Status ${res.statusCode})`;

        // Geo/Device extras
        const latitude = req.headers['x-latitude'] || req.body?.latitude || null;
        const longitude = req.headers['x-longitude'] || req.body?.longitude || null;
        const macAddress = req.headers['x-mac-address'] || req.body?.macAddress || null;

        // Error message if request failed
        let errorMessage = null;
        if (res.statusCode >= 400) {
          errorMessage = res.locals?.errorMessage || req.logErrorMessage || `HTTP ${res.statusCode}: ${res.statusMessage || 'Request failed'}`;
        }

        await insertLog({
          userId,
          userRole,
          roleId,
          action,
          route,
          method,
          ipAddress,
          description,
          logCategory,
          isLatest: 'Y',
          systemType,
          macAddress,
          latitude,
          longitude,
          errorMessage,
          apiEndpoint,
          deviceType,
          facilities
        });
      } catch (err) {
        // Silently swallow logger middleware error to preserve primary functionality
      }
    });
  });

  next();
}

/**
 * Manual logger function for explicit log entries from anywhere in backend.
 */
async function logCustomActivity(req, logDetails = {}) {
  try {
    const userAgent = req?.headers ? (req.headers['user-agent'] || '') : '';
    const ipAddress = req?.headers ? (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1') : '127.0.0.1';

    await insertLog({
      userId: logDetails.userId || req?.user?.userId || null,
      userRole: logDetails.userRole || req?.user?.role || null,
      roleId: logDetails.roleId || req?.user?.roleId || null,
      action: logDetails.action || req?.method || 'CUSTOM',
      route: logDetails.route || req?.baseUrl || '/',
      method: logDetails.method || req?.method || 'N/A',
      ipAddress: logDetails.ipAddress || ipAddress,
      description: logDetails.description || 'Custom Activity Log',
      logCategory: logDetails.logCategory || 'BUSINESS_LOG',
      isLatest: 'Y',
      systemType: logDetails.systemType || userAgent,
      macAddress: logDetails.macAddress || null,
      latitude: logDetails.latitude || null,
      longitude: logDetails.longitude || null,
      errorMessage: logDetails.errorMessage || null,
      apiEndpoint: logDetails.apiEndpoint || req?.originalUrl || null,
      deviceType: logDetails.deviceType || parseDeviceType(userAgent),
      facilities: logDetails.facilities || req?.user?.facilityId || null
    });
  } catch (err) {
    // Non-blocking log catch
  }
}

module.exports = {
  logActivityMiddleware,
  logCustomActivity
};
