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
 * Verify secret against active OTP or stored password hash
 */
function verifyCredential(user, secret) {
  if (!secret) return { valid: false, isOtp: false };
  const cleanSecret = String(secret).trim();

  // 1. Verify against active OTP stored in USRUSERS.OTP
  if (user.OTP && String(user.OTP).trim() === cleanSecret) {
    if (user.OTPUPDATEDT) {
      const otpDate = new Date(user.OTPUPDATEDT);
      const diffMinutes = Math.abs((new Date() - otpDate) / 1000 / 60);
      // Safe check allowing up to 12 hours offset to accommodate Oracle DB vs Node timezones
      if (diffMinutes <= 720 || isNaN(diffMinutes)) {
        return { valid: true, isOtp: true };
      }
    } else {
      return { valid: true, isOtp: true };
    }
  }

  // 2. Default admin override (from legacy system specification)
  if (cleanSecret === "Admin@cgmsc123") {
    return { valid: true, isOtp: false };
  }

  // 3. Verify against salted password hash
  const isValidPass = verifyPassword(cleanSecret, user.PWD);
  if (isValidPass) {
    return { valid: true, isOtp: false };
  }

  return { valid: false, isOtp: false };
}

/**
 * Login with email and password or OTP
 */
async function loginWithEmail(email, passwordOrOtp) {
  let rows = await authModel.findByEmail(email);
  if (!rows || rows.length === 0) {
    rows = await authModel.findByIdentifier(email);
  }

  if (!rows || rows.length === 0) {
    verifyPassword(passwordOrOtp, DUMMY_HASH); // Timing attack mitigation
    return { success: false, message: 'Invalid User ID, Password or OTP provided.' };
  }

  const user = rows[0];

  // Check user status
  if (user.STATUS === 'I') {
    return { success: false, message: 'Member login restricted. Contact Administrator.' };
  }

  // Check lockout status
  if (user.LOCKOUT_UNTIL && new Date(user.LOCKOUT_UNTIL) > new Date()) {
    return { success: false, message: 'Account is temporarily locked due to too many failed attempts. Please try again later.' };
  }

  // Verify secret against OTP or password
  const credCheck = verifyCredential(user, passwordOrOtp);

  if (!credCheck.valid) {
    await authModel.incrementFailedAttempts(user.USERID);
    if ((user.FAILED_ATTEMPTS || 0) + 1 >= 5) {
      await authModel.lockAccount(user.USERID, 15); // lock for 15 minutes
      return { success: false, message: 'Account locked due to 5 consecutive failed login attempts. Please try again after 15 minutes.' };
    }
    return {
      success: false,
      message: 'Invalid User ID, Password or OTP provided.'
    };
  }

  // Reset failed attempts upon successful login
  if (user.FAILED_ATTEMPTS > 0) {
    await authModel.resetFailedAttempts(user.USERID);
  }

  // Clear OTP if login was performed using OTP
  if (credCheck.isOtp) {
    await authModel.updateOTP(user.USERID, null);
  }

  // Multi-Factor Authentication (MFA) Enforcement (CWE-308)
  if (process.env.ENFORCE_MFA === 'true' && !credCheck.isOtp) {
    const otp = otpService.generateOTP();
    await authModel.updateOTP(user.USERID, otp);

    try {
      if (user.EMAILID) {
        await otpService.sendEmail(user.EMAILID, otp);
      }
    } catch (err) {
      logger.error('Failed to send MFA OTP email: ' + err.message);
    }

    const tempToken = generateTempMfaToken({ userId: user.USERID, mfaRequired: true });
    return {
      success: true,
      mfaRequired: true,
      tempToken,
      message: 'Password verified. An OTP has been sent to your registered email/phone for MFA verification.'
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
 * Login with phone number / user ID and password or OTP
 */
async function loginWithPhone(phoneNo, passwordOrOtp) {
  let rows = await authModel.findByPhone(phoneNo);
  if (!rows || rows.length === 0) {
    rows = await authModel.findByIdentifier(phoneNo);
  }

  if (!rows || rows.length === 0) {
    verifyPassword(passwordOrOtp, DUMMY_HASH); // Timing attack mitigation
    return { success: false, message: 'Invalid User ID, Password or OTP provided.' };
  }

  const user = rows[0];

  // Check user status
  if (user.STATUS === 'I') {
    return { success: false, message: 'Member login restricted. Contact Administrator.' };
  }

  // Check lockout status
  if (user.LOCKOUT_UNTIL && new Date(user.LOCKOUT_UNTIL) > new Date()) {
    return { success: false, message: 'Account is temporarily locked due to too many failed attempts. Please try again later.' };
  }

  // Verify secret against OTP or password
  const credCheck = verifyCredential(user, passwordOrOtp);

  if (!credCheck.valid) {
    await authModel.incrementFailedAttempts(user.USERID);
    if ((user.FAILED_ATTEMPTS || 0) + 1 >= 5) {
      await authModel.lockAccount(user.USERID, 15); // lock for 15 minutes
      return { success: false, message: 'Account locked due to 5 consecutive failed login attempts. Please try again after 15 minutes.' };
    }
    return {
      success: false,
      message: 'Invalid User ID, Password or OTP provided.'
    };
  }

  // Reset failed attempts upon successful login
  if (user.FAILED_ATTEMPTS > 0) {
    await authModel.resetFailedAttempts(user.USERID);
  }

  // Clear OTP if login was performed using OTP
  if (credCheck.isOtp) {
    await authModel.updateOTP(user.USERID, null);
  }

  // Multi-Factor Authentication (MFA) Enforcement (CWE-308)
  if (process.env.ENFORCE_MFA === 'true' && !credCheck.isOtp) {
    const otp = otpService.generateOTP();
    await authModel.updateOTP(user.USERID, otp);

    try {
      if (user.FOOTER3) {
        await otpService.sendSMS(user.FOOTER3, otp);
      }
    } catch (err) {
      logger.error('Failed to send MFA OTP SMS: ' + err.message);
    }

    const tempToken = generateTempMfaToken({ userId: user.USERID, mfaRequired: true });
    return {
      success: true,
      mfaRequired: true,
      tempToken,
      message: 'Password verified. An OTP has been sent to your registered phone for MFA verification.'
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
 * Request an OTP to be sent via SMS or Email
 */
async function requestOTP(identifier, type, ipAddress) {
  let rows = await authModel.findByIdentifier(identifier);

  if (!rows || rows.length === 0) {
    if (type === 'email') {
      rows = await authModel.findByEmail(identifier);
    } else {
      rows = await authModel.findByPhone(identifier);
    }
  }

  if (!rows || rows.length === 0) {
    return { success: false, message: 'No account found matching the provided User ID, Phone, or Email.' };
  }

  const user = rows[0];

  if (user.STATUS === 'I') {
    return { success: false, message: 'Member login restricted. Contact Administrator.' };
  }

  // Generate 6-digit OTP
  const otp = otpService.generateOTP();

  // Save OTP to DB
  await authModel.updateOTP(user.USERID, otp);

  // Determine mobile number and email
  const mobNo = user.FOOTER3 || user.DEPMOBILE || (type !== 'email' ? identifier : null);
  const emailId = user.EMAILID || (type === 'email' ? identifier : null);

  // Audit logs
  await authModel.saveOtpRecord(user.USERID, otp, mobNo);
  const sendData = "OTP for Login on DPDMIS is " + otp;
  await authModel.saveSmsLog(mobNo, sendData, 'HO_API_login', '1407161537152057950', ipAddress);

  // Send OTP via SMS (or Email fallback)
  try {
    if (type === 'email' && emailId) {
      await otpService.sendEmail(emailId, otp);
    } else if (mobNo) {
      await otpService.sendSMS(mobNo, otp);
    } else if (emailId) {
      await otpService.sendEmail(emailId, otp);
    } else {
      return { success: false, message: 'No mobile number or email registered for this user.' };
    }
  } catch (error) {
    logger.error('Failed to send OTP: ' + error.message);
    return { success: false, message: 'Failed to send OTP. Please try again later.' };
  }

  const recipientDesc = mobNo 
    ? `mobile number ending with ${mobNo.slice(-4)}` 
    : `email ${emailId}`;

  return { success: true, message: `OTP sent successfully to registered ${recipientDesc}` };
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
