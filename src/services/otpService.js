const twilio = require('twilio');
const sgMail = require('@sendgrid/mail');
const logger = require('../utils/logger');
require('dotenv').config();

// Initialize Twilio
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Generate a random 6-digit OTP
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP via DPDMIS SMS API (with Twilio & Mock fallbacks)
 */
async function sendSMS(toPhone, otp) {
  const message = `OTP for Login on DPDMIS is ${otp}`;
  const templateId = "1407161537152057950";
  const smsServiceType = "otpmsg";
  const cleanPhone = String(toPhone || '').trim();

  // Try DPDMIS SMS API
  try {
    const payload = {
      mobileNo: cleanPhone,
      message: message,
      templateId: templateId,
      smsServiceType: smsServiceType
    };

    const response = await fetch('https://dpdmis.in/SMSASP/api/SmsTest/Send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      logger.info(`OTP sent via DPDMIS SMS API to ${cleanPhone}`);
      return true;
    } else {
      logger.warn(`DPDMIS SMS API returned HTTP ${response.status}`);
    }
  } catch (error) {
    logger.warn(`DPDMIS SMS API dispatch failed: ${error.message}`);
  }

  // Fallback to Twilio if configured
  if (twilioClient) {
    try {
      const recipient = process.env.RECIPIENT_PHONE_NUMBER || cleanPhone;
      await twilioClient.messages.create({
        body: `${message}. Valid for 5 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: recipient
      });
      logger.info(`OTP sent via Twilio SMS to ${recipient}`);
      return true;
    } catch (error) {
      logger.error(`Twilio SMS error: ${error.message}`);
    }
  }

  // Fallback mock log for local/testing
  logger.info(`[MOCK SMS] to ${cleanPhone}: ${message}`);
  return true;
}

/**
 * Send OTP via Email using SendGrid
 */
async function sendEmail(toEmail, otp) {
  if (!process.env.SENDGRID_API_KEY) {
    logger.warn('SendGrid is not configured. Mocking Email send.');
    logger.info(`[MOCK EMAIL] to ${toEmail}: Your login OTP is ${otp}`);
    return true;
  }

  const msg = {
    to: toEmail,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'Your Login OTP - Facility Module',
    text: `Your Facility Module login OTP is: ${otp}\n\nIt is valid for 5 minutes.`,
    html: `<p>Your Facility Module login OTP is: <strong>${otp}</strong></p><p>It is valid for 5 minutes.</p>`,
  };

  try {
    await sgMail.send(msg);
    logger.info(`OTP sent via Email to ${toEmail}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send Email: ${error.message}`);
    throw new Error('Failed to send Email OTP');
  }
}

module.exports = {
  generateOTP,
  sendSMS,
  sendEmail
};
