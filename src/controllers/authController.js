const authService = require('../services/authService');
const logger = require('../utils/logger');
const { verifyRefreshToken, generateTokens, verifyTempMfaToken } = require('../utils/jwtHelper');

/**
 * POST /api/auth/login/email
 * Login with email and password
 * Body: { email: string, password: string }
 */
async function loginWithEmail(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email && !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    logger.info(`Login attempt with email: ${email}`);
    const result = await authService.loginWithEmail(email, password);

    if (!result.success) {
      return res.status(401).json(result);
    }

    logger.info(`Login successful for email: ${email}`);
    return res.status(200).json(result);
  } catch (error) {
    logger.error('Email login error: ' + error.message);
    next(error);
  }
}

/**
 * POST /api/auth/login/phone
 * Login with phone number and password
 * Body: { phoneNo: string, password: string }
 */
async function loginWithPhone(req, res, next) {
  try {
    const { phoneNo, password } = req.body;

    if (!phoneNo && !password) {
      return res.status(400).json({ success: false, message: 'Phone number and password are required' });
    }
    if (!phoneNo) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    logger.info(`Login attempt with phone: ${phoneNo}`);
    const result = await authService.loginWithPhone(phoneNo, password);

    if (!result.success) {
      return res.status(401).json(result);
    }

    logger.info(`Login successful for phone: ${phoneNo}`);
    return res.status(200).json(result);
  } catch (error) {
    logger.error('Phone login error: ' + error.message);
    next(error);
  }
}

/**
 * POST /api/auth/otp/send
 * Request an OTP
 * Body: { type: 'email' | 'phone', identifier: 'chctilda@dpdmis.in' | '9876543210' }
 */
async function sendOTP(req, res, next) {
  try {
    const { type, identifier } = req.body;
    
    if (!type || !identifier) {
      return res.status(400).json({ success: false, message: 'Type (email/phone) and identifier are required' });
    }

    if (type !== 'email' && type !== 'phone') {
      return res.status(400).json({ success: false, message: 'Type must be either email or phone' });
    }

    logger.info(`Requesting OTP for ${type}: ${identifier}`);
    const result = await authService.requestOTP(identifier, type);

    if (!result.success) {
      return res.status(400).json(result);
    }
    
    return res.status(200).json(result);
  } catch (error) {
    logger.error('Send OTP error: ' + error.message);
    next(error);
  }
}

/**
 * POST /api/auth/login/mfa
 * Verify OTP using the temporary MFA token
 * Body: { tempToken: 'eyJ...', otp: '123456' }
 */
async function verifyMfa(req, res, next) {
  try {
    const { tempToken, otp } = req.body;
    
    if (!tempToken || !otp) {
      return res.status(400).json({ success: false, message: 'tempToken and otp are required' });
    }

    let decoded;
    try {
      decoded = verifyTempMfaToken(tempToken);
    } catch (error) {
      logger.error('MFA Temp Token verification failed: ' + error.message);
      return res.status(401).json({ success: false, message: 'MFA session expired or invalid. Please login again.' });
    }

    if (!decoded.mfaRequired || !decoded.userId) {
      return res.status(400).json({ success: false, message: 'Invalid token payload for MFA.' });
    }

    logger.info(`Verifying MFA OTP for user: ${decoded.userId}`);
    const result = await authService.verifyMfa(decoded.userId, otp);

    if (!result.success) {
      return res.status(401).json(result); // Unauthorized if wrong OTP
    }
    
    logger.info(`MFA Login successful for user: ${decoded.userId}`);
    return res.status(200).json(result);
  } catch (error) {
    logger.error('Verify MFA error: ' + error.message);
    next(error);
  }
}

/**
 * POST /api/auth/refresh
 * Refresh access token using a valid refresh token
 * Body: { refreshToken: string }
 */
async function refreshToken(req, res, next) {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Refresh token is required' });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (error) {
      logger.error('Refresh token verification failed: ' + error.message);

      if (error.name === 'TokenExpiredError') {
        return res.status(403).json({ success: false, message: 'Refresh token has expired. Please login again.' });
      }

      return res.status(403).json({ success: false, message: 'Invalid refresh token.' });
    }

    // Issue new tokens with the same payload (strip jwt metadata fields)
    const payload = {
      userId: decoded.userId,
      emailId: decoded.emailId,
      firstName: decoded.firstName,
      lastName: decoded.lastName,
      facilityId: decoded.facilityId
    };

    const tokens = generateTokens(payload);

    logger.info(`Token refreshed for user: ${decoded.userId}`);
    return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (error) {
    logger.error('Refresh token error: ' + error.message);
    next(error);
  }
}

const WEAK_PASSWORDS = ['password123', 'admin123', '12345678', 'qwerty12', 'password'];

async function changePassword(req, res, next) {
  try {
    const userId = req.user.userId;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Old password and new password are required' });
    }

    if (oldPassword === newPassword) {
      return res.status(400).json({ success: false, message: 'New password cannot be the same as the old password' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character.' 
      });
    }

    if (WEAK_PASSWORDS.includes(newPassword.toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Password is too weak or common. Please choose a stronger password.' });
    }

    logger.info(`Password change attempt for user: ${userId}`);
    const result = await authService.changePassword(userId, oldPassword, newPassword);

    if (!result.success) {
      return res.status(400).json(result);
    }

    logger.info(`Password changed successfully for user: ${userId}`);
    return res.status(200).json(result);
  } catch (error) {
    logger.error('Change password error: ' + error.message);
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    const userId = req.user.userId;
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    logger.info(`Logout attempt for user: ${userId}`);
    const result = await authService.logout(userId, ipAddress);
    
    return res.status(200).json(result);
  } catch (error) {
    logger.error('Logout error: ' + error.message);
    next(error);
  }
}

module.exports = {
  loginWithEmail,
  loginWithPhone,
  sendOTP,
  verifyMfa,
  refreshToken,
  changePassword,
  logout
};
