import crypto from 'crypto';
import { env } from '../config/env.js';
import { ApiError } from '../utils/http.js';
import { Resend } from 'resend';
import logger from './logger.js';

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

export const createVerificationCode = () => {
  // 6-digit numeric code
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const hashVerificationCode = (code) => {
  // Simple hash for storage - in production use bcrypt or similar
  return crypto.createHash('sha256').update(code).digest('hex');
};

export const sendVerificationEmail = async (email, code) => {
  if (!resend) {
    logger.warn('Resend not configured, skipping email send');
    return;
  }

  try {
    await resend.emails.send({
      from: env.resendFromEmail || 'noreply@kredibble.app',
      to: email,
      subject: 'Your Kredibble verification code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">Your verification code</h2>
          <p>Use this code to verify your email address:</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #1a1a1a;">
            ${code}
          </div>
          <p style="color: #666; font-size: 14px;">This code expires in ${env.emailVerificationCodeTtlMinutes} minutes.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    logger.error({ error: error.message, email }, 'Failed to send verification email');
    // Don't throw - email is best effort
    throw new ApiError(502, 'Failed to send verification email');
  }
};