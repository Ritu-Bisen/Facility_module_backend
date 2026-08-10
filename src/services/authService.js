const authModel = require('../models/authModel');
const crypto = require('crypto');
const logger = require('../utils/logger');
const SaltedHash = require('../utils/saltedHash');
const otpService = require('./otpService');
const { generateTokens, generateTempMfaToken } = require('../utils/jwtHelper');

/**
 * Build a JWT payload from a user row
 */
function buildTokenPayload(user, sessionId) {
  return {
    userId: user.USERID,
    emailId: user.EMAILID,
    firstName: user.FIRSTNAME,
    lastName: user.LASTNAME,
    facilityId: user.FACILITYID,
    roleId: user.ROLEID,
    roleName: user.ROLENAME,
    sessionId: sessionId
  };
}

const DUMMY_HASH = "salt{dummy}hash{dummy}";

/**
 * Parse the legacy password format: salt{<salt>}hash{<hash>}
 * This matches the C# Broadline.Common.SecUtils.SaltedHash format
 */
function parseSaltedHash(storedPwd) {
  const mStart = 'salt{';
  const mMid = '}hash{';
  const mEnd = '}';

  const saltStartIdx = storedPwd.indexOf(mStart) + mStart.length;
  const saltEndIdx = storedPwd.indexOf(mMid);
  const hashStartIdx = storedPwd.indexOf(mMid) + mMid.length;
  const hashEndIdx = storedPwd.lastIndexOf(mEnd);

  const salt = storedPwd.substring(saltStartIdx, saltEndIdx);
  const hash = storedPwd.substring(hashStartIdx, hashEndIdx);

  return { salt, hash };
}

/**
 * Verify password against stored salted hash
 */
function verifyPassword(password, storedPwd) {
  try {
    const { salt, hash } = parseSaltedHash(storedPwd);
    const verifier = SaltedHash.createFromExisting(salt, hash);
    return verifier.verify(password);
  } catch (err) {
    logger.error('Password verification error: ' + err.message);
    return false;
  }
}

/**
 * Login with email and password
 */
async function loginWithEmail(email, password) {
  const rows = await authModel.findByEmail(email);

  if (!rows || rows.length === 0) {
    verifyPassword(password, DUMMY_HASH); // Timing attack mitigation
    return { success: false, message: 'Invalid credentials provided.' };
  }

  const user = rows[0];

  // Check user status
  if (user.STATUS === 'I') {
    return { success: false, message: 'Member login restricted. Contact Administrator.' };
  }

  // Verify password
  const isValid = verifyPassword(password, user.PWD);

  if (!isValid) {
    return {
      success: false,
      message: 'Invalid credentials provided.'
    };
  }

  // Generate a new session ID for concurrent login prevention
  const sessionId = crypto.randomUUID();
  await authModel.updateSessionId(user.USERID, sessionId);

  // Generate JWT tokens
  const tokenPayload = buildTokenPayload(user, sessionId);
  const { accessToken, refreshToken } = generateTokens(tokenPayload);

  // Return user data with tokens
  return {
    success: true,
    message: 'Login successful',
    data: {
      userId: user.USERID,
      emailId: user.EMAILID,
      firstName: user.FIRSTNAME,
      lastName: user.LASTNAME,
      facilityId: user.FACILITYID,
      roleId: user.ROLEID,
      roleName: user.ROLENAME,
      footer1: user.FOOTER1,
      footer2: user.FOOTER2,
      footer3: user.FOOTER3
    },
    accessToken,
    refreshToken
  };
}

/**
 * Login with phone number and password
 */
async function loginWithPhone(phoneNo, password) {
  const rows = await authModel.findByPhone(phoneNo);

  if (!rows || rows.length === 0) {
    verifyPassword(password, DUMMY_HASH); // Timing attack mitigation
    return { success: false, message: 'Invalid credentials provided.' };
  }

  const user = rows[0];

  // Check user status
  if (user.STATUS === 'I') {
    return { success: false, message: 'Member login restricted. Contact Administrator.' };
  }

  // Verify password
  const isValid = verifyPassword(password, user.PWD);

  if (!isValid) {
    return {
      success: false,
      message: 'Invalid credentials provided.'
    };
  }

  // Generate a new session ID for concurrent login prevention
  const sessionId = crypto.randomUUID();
  await authModel.updateSessionId(user.USERID, sessionId);

  // Generate JWT tokens
  const tokenPayload = buildTokenPayload(user, sessionId);
  const { accessToken, refreshToken } = generateTokens(tokenPayload);

  // Return user data with tokens
  return {
    success: true,
    message: 'Login successful',
    data: {
      userId: user.USERID,
      emailId: user.EMAILID,
      firstName: user.FIRSTNAME,
      lastName: user.LASTNAME,
      facilityId: user.FACILITYID,
      roleId: user.ROLEID,
      roleName: user.ROLENAME,
      footer1: user.FOOTER1,
      footer2: user.FOOTER2,
      footer3: user.FOOTER3
    },
    accessToken,
    refreshToken
  };
}

/**
 * Request an OTP to be sent via Email or Phone
 */
async function requestOTP(identifier, type) {
  let rows;
  if (type === 'email') {
    rows = await authModel.findByEmail(identifier);
  } else if (type === 'phone') {
    rows = await authModel.findByPhone(identifier);
  } else {
    return { success: false, message: 'Invalid type' };
  }

  if (!rows || rows.length === 0) {
    return { success: false, message: 'Invalid credentials provided.' };
  }

  const user = rows[0];

  if (user.STATUS === 'I') {
    return { success: false, message: 'Member login restricted. Contact Administrator.' };
  }

  // Generate OTP
  const otp = otpService.generateOTP();

  // Save OTP to DB
  await authModel.updateOTP(user.USERID, otp);

  // Send OTP
  try {
    if (type === 'email') {
      await otpService.sendEmail(user.EMAILID, otp);
    } else {
      // Send to the phone number stored in FOOTER3
      await otpService.sendSMS(user.FOOTER3, otp);
    }
  } catch (error) {
    return { success: false, message: 'Failed to send OTP. Please try again later.' };
  }

  return { success: true, message: `OTP sent successfully to your ${type}` };
}

/**
 * Verify OTP and login (MFA Step 2)
 */
async function verifyMfa(userId, otp) {
  const user = await authModel.findFullUserById(userId);

  if (!user) {
    return { success: false, message: 'Invalid user.' };
  }

  if (user.STATUS === 'I') {
    return { success: false, message: 'Member login restricted. Contact Administrator.' };
  }

  // Verify OTP exists and matches
  if (!user.OTP || user.OTP !== otp) {
    return { success: false, message: 'The OTP you entered is incorrect' };
  }

  // Verify OTP expiry (5 minutes)
  const otpDate = new Date(user.OTPUPDATEDT);
  const now = new Date();
  const diffMinutes = (now - otpDate) / 1000 / 60;
  
  if (diffMinutes > 5) {
    return { success: false, message: 'The OTP has expired. Please request a new one.' };
  }

  // Clear the OTP after successful verification to prevent reuse
  await authModel.updateOTP(user.USERID, null);

  // Generate a new session ID for concurrent login prevention
  const sessionId = crypto.randomUUID();
  await authModel.updateSessionId(user.USERID, sessionId);

  // Generate JWT tokens
  const tokenPayload = buildTokenPayload(user, sessionId);
  const { accessToken, refreshToken } = generateTokens(tokenPayload);

  // Return user data with tokens
  return {
    success: true,
    message: 'OTP Login successful',
    data: {
      userId: user.USERID,
      emailId: user.EMAILID,
      firstName: user.FIRSTNAME,
      lastName: user.LASTNAME,
      facilityId: user.FACILITYID,
      roleId: user.ROLEID,
      roleName: user.ROLENAME,
      footer1: user.FOOTER1,
      footer2: user.FOOTER2,
      footer3: user.FOOTER3
    },
    accessToken,
    refreshToken
  };
}

async function changePassword(userId, oldPassword, newPassword) {
  const user = await authModel.findUserById(userId);
  if (!user) {
    return { success: false, message: 'User not found' };
  }

  // Verify old password
  const isValid = verifyPassword(oldPassword, user.PWD);
  if (!isValid) {
    return { success: false, message: 'The old password you entered is incorrect' };
  }

  // Hash new password
  const sh = SaltedHash.create(newPassword);
  const newHashedPassword = `salt{${sh.salt}}hash{${sh.hash}}`;

  await authModel.updatePassword(userId, newHashedPassword);
  
  // CWE-613: Invalidate all active sessions to force re-authentication
  await authModel.updateSessionId(userId, null);
  
  return { success: true, message: 'Password changed successfully. You have been logged out of all devices.' };
}

async function logout(userId, ipAddress) {
  // 1 is the operation code for logout in the legacy system
  await authModel.insertAuditLog(userId, 1, ipAddress);
  // Clear the session ID to log them out
  await authModel.updateSessionId(userId, null);
  return { success: true, message: 'Logged out successfully' };
}

module.exports = {
  loginWithEmail,
  loginWithPhone,
  requestOTP,
  verifyMfa,
  changePassword,
  logout
};
