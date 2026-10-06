import crypto from 'crypto';
import { env } from '../config/env.js';
import { ApiError } from '../utils/http.js';
import { Resend } from 'resend';
import logger from './logger.js';

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

export const createVerificationCode = () => {
  // SEC-062: Use cryptographically secure RNG for verification codes
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
};

export const hashVerificationCode = (code) => {
  // SEC-101: Keyed HMAC with server secret prevents offline brute-forcing of 6-digit codes
  return crypto.createHmac('sha256', env.jwtSecret).update(String(code)).digest('hex');
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

export const sendPasswordResetEmail = async (email, code, ttlMinutes) => {
  if (!resend) {
    logger.warn('Resend not configured, skipping password reset email');
    return;
  }

  const result = await resend.emails.send({
    from: env.resendFromEmail || 'noreply@kredibble.app',
    to: email,
    subject: 'Reset your Kredibble password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Reset your password</h2>
        <p>Enter this code in the Kredibble app to choose a new password:</p>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #1a1a1a;">
          ${code}
        </div>
        <p style="color: #666; font-size: 14px;">This code expires in ${ttlMinutes} minutes.</p>
        <p style="color: #666; font-size: 14px;">If you didn't ask to reset your password, ignore this email. Your password won't change.</p>
      </div>
    `,
  });
  if (result?.error) throw new Error(result.error.message);
};
