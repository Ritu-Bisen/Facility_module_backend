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
 * Send OTP via SMS using Twilio
 */
async function sendSMS(toPhone, otp) {
  if (!twilioClient) {
    logger.warn('Twilio is not configured. Mocking SMS send.');
    logger.info(`[MOCK SMS] to ${toPhone}: Your login OTP is ${otp}`);
    return true;
  }

  try {
    // If testing on a trial account, you might only be able to send to RECIPIENT_PHONE_NUMBER
    const recipient = process.env.RECIPIENT_PHONE_NUMBER || toPhone;
    
    await twilioClient.messages.create({
      body: `Your Facility Module login OTP is: ${otp}. It is valid for 5 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: recipient
    });
    logger.info(`OTP sent via SMS to ${recipient}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send SMS: ${error.message}`);
    throw new Error('Failed to send SMS OTP');
  }
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
