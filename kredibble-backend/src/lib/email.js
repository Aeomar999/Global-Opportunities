import crypto from 'crypto';
import { env } from '../config/env.js';
import { ApiError } from '../utils/http.js';

export const createVerificationCode = () => crypto.randomInt(100000, 1000000).toString();
export const hashVerificationCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

export const sendVerificationEmail = async (email, code) => {
  if (!env.resendApiKey || env.resendApiKey.includes('placeholder') || !env.resendFromEmail) {
    throw new ApiError(503, 'Resend is not configured');
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.resendFromEmail,
      to: [email],
      subject: 'Verify your Kredibble email',
      text: `Your Kredibble verification code is ${code}. It expires in ${env.emailVerificationCodeTtlMinutes} minutes.`,
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new ApiError(502, payload.message || 'Resend could not send the verification email');
  return payload;
};
